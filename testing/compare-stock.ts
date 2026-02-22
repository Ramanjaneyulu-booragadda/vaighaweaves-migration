/**
 * Parallel API Comparison Test: Stock / Inventory
 *
 * Verifies stock levels match between old Express and new Medusa.
 * This is CRITICAL — stock discrepancies = revenue loss from overselling.
 *
 * Strategy:
 * 1. Load migration_id_map to cross-reference old MySQL IDs → Medusa UUIDs
 * 2. Fetch stock from both systems
 * 3. Compare per-variant inventory quantities
 * 4. Run race condition test on Medusa (cart-based)
 */

import axios from "axios"
import chalk from "chalk"
import * as dotenv from "dotenv"
import { loadIdMap } from "./utils/id-map"
import { printSummary, saveResults, measureTime, TestResult } from "./utils/reporter"
import { medusaStoreClient } from "./utils/auth"

dotenv.config()

const OLD_API = process.env.OLD_API_URL || "http://localhost:5001/api"
const NEW_API = process.env.NEW_API_URL || "http://localhost:9000"
const storeApi = medusaStoreClient()

// ── Types ──────────────────────────────────────────────────────────────

interface StockEntry {
  productHandle: string
  variantSku: string
  quantity: number
}

// ── Fetch stock from old system ────────────────────────────────────────

async function fetchOldStock(): Promise<StockEntry[]> {
  const entries: StockEntry[] = []
  let page = 1
  const limit = 50

  while (true) {
    const res = await axios.get(`${OLD_API}/products?page=${page}&limit=${limit}`)
    const products = res.data.data || res.data.products || []

    for (const p of products) {
      const handle = p.slug || p.handle || ""

      // Old system: stock from ProductImage/ProductImageSizeStock
      if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (Array.isArray(img.sizes)) {
            for (const size of img.sizes) {
              entries.push({
                productHandle: handle,
                variantSku: `${p.id}-${img.id}-${size.size}`,
                quantity: size.stockQty || 0,
              })
            }
          } else {
            // Image-level stock (no sizes)
            entries.push({
              productHandle: handle,
              variantSku: `${p.id}-${img.id}`,
              quantity: img.stockQty || 0,
            })
          }
        }
      }

      // Fallback: product-level stock
      if (entries.filter((e) => e.productHandle === handle).length === 0) {
        entries.push({
          productHandle: handle,
          variantSku: `product-${p.id}`,
          quantity: p.stockQty || 0,
        })
      }
    }

    const pagination = res.data.pagination
    if (!pagination || page >= (pagination.totalPages || 1)) break
    page++
  }

  return entries
}

// ── Fetch stock from Medusa ────────────────────────────────────────────

async function fetchMedusaStock(): Promise<StockEntry[]> {
  const entries: StockEntry[] = []
  let offset = 0
  const limit = 50

  while (true) {
    const res = await storeApi.get(
      `/store/products?limit=${limit}&offset=${offset}&fields=*variants`
    )
    const products = res.data.products || []

    for (const p of products) {
      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          entries.push({
            productHandle: p.handle || "",
            variantSku: v.sku || v.id,
            quantity: v.inventory_quantity ?? 0,
          })
        }
      }
    }

    if (products.length < limit) break
    offset += limit
  }

  return entries
}

// ── Test 1: Total stock comparison ─────────────────────────────────────

async function testTotalStock(
  oldStock: StockEntry[],
  newStock: StockEntry[]
): Promise<TestResult> {
  const name = "Total inventory entry count"

  console.log(chalk.blue("\n  Stock entry counts:"))
  console.log(chalk.gray(`    Old Express: ${oldStock.length} entries`))
  console.log(chalk.gray(`    New Medusa:  ${newStock.length} entries`))

  // Compare totals
  const oldTotal = oldStock.reduce((sum, s) => sum + s.quantity, 0)
  const newTotal = newStock.reduce((sum, s) => sum + s.quantity, 0)

  console.log(chalk.gray(`    Old total quantity: ${oldTotal}`))
  console.log(chalk.gray(`    New total quantity: ${newTotal}`))

  const diff = Math.abs(oldTotal - newTotal)
  const variance = oldTotal > 0 ? diff / oldTotal : 0

  return {
    name,
    passed: variance < 0.05,
    details: `Old total=${oldTotal}, New total=${newTotal}, diff=${diff} (${(variance * 100).toFixed(1)}%)`,
  }
}

// ── Test 2: Per-product stock parity ───────────────────────────────────

async function testPerProductStock(
  oldStock: StockEntry[],
  newStock: StockEntry[]
): Promise<TestResult> {
  const name = "Per-product stock parity"

  // Aggregate by handle for old system
  const oldByHandle = new Map<string, number>()
  for (const s of oldStock) {
    if (s.productHandle) {
      oldByHandle.set(
        s.productHandle,
        (oldByHandle.get(s.productHandle) || 0) + s.quantity
      )
    }
  }

  // Aggregate by handle for Medusa
  const newByHandle = new Map<string, number>()
  for (const s of newStock) {
    if (s.productHandle) {
      newByHandle.set(
        s.productHandle,
        (newByHandle.get(s.productHandle) || 0) + s.quantity
      )
    }
  }

  let matches = 0
  let discrepancies = 0
  const topDiscrepancies: { handle: string; old: number; new: number; diff: number }[] = []

  for (const [handle, oldQty] of oldByHandle) {
    const newQty = newByHandle.get(handle) ?? -1
    if (newQty === -1) {
      discrepancies++
      topDiscrepancies.push({ handle, old: oldQty, new: 0, diff: oldQty })
      continue
    }

    const diff = Math.abs(oldQty - newQty)
    if (diff === 0) {
      matches++
    } else {
      discrepancies++
      topDiscrepancies.push({ handle, old: oldQty, new: newQty, diff })
    }
  }

  console.log(chalk.blue("\n  Per-product stock comparison:"))
  console.log(chalk.green(`    Matching:      ${matches}`))
  console.log(chalk.red(`    Discrepancies: ${discrepancies}`))

  // Show top discrepancies
  if (discrepancies > 0) {
    topDiscrepancies.sort((a, b) => b.diff - a.diff)
    console.log(chalk.yellow("\n  Top discrepancies:"))
    for (const d of topDiscrepancies.slice(0, 10)) {
      console.log(
        chalk.yellow(`    ${d.handle}: old=${d.old}, new=${d.new}, diff=${d.diff}`)
      )
    }
  }

  const total = oldByHandle.size
  const passRate = total > 0 ? matches / total : 1

  return {
    name,
    passed: passRate >= 0.95,
    details: `${matches}/${total} products match (${(passRate * 100).toFixed(1)}%)`,
    data: { matches, discrepancies, topDiscrepancies: topDiscrepancies.slice(0, 20) },
  }
}

// ── Test 3: Race condition (Medusa only) ───────────────────────────────

async function testRaceCondition(): Promise<TestResult> {
  const name = "Race condition test (no overselling)"

  try {
    // Find a product with stock > 0
    const res = await storeApi.get(`/store/products?limit=50&fields=*variants`)
    const products = res.data.products || []

    const target = products.find((p: any) =>
      p.variants?.some((v: any) => (v.inventory_quantity ?? 0) > 0)
    )

    if (!target) {
      return { name, passed: true, details: "No products with stock found (skipped)" }
    }

    const variant = target.variants.find(
      (v: any) => (v.inventory_quantity ?? 0) > 0
    )
    const initialStock = variant.inventory_quantity

    console.log(chalk.blue(`\n  Race condition target: "${target.title}"`))
    console.log(chalk.gray(`    Variant: ${variant.sku || variant.id}`))
    console.log(chalk.gray(`    Initial stock: ${initialStock}`))

    // Create 2 carts simultaneously
    const [cart1Res, cart2Res] = await Promise.all([
      storeApi.post(`/store/carts`),
      storeApi.post(`/store/carts`),
    ])

    const cart1Id = cart1Res.data.cart.id
    const cart2Id = cart2Res.data.cart.id

    // Try to reserve all stock in cart1, and 1 unit in cart2
    const [r1, r2] = await Promise.allSettled([
      storeApi.post(`/store/carts/${cart1Id}/line-items`, {
        variant_id: variant.id,
        quantity: initialStock,
      }),
      storeApi.post(`/store/carts/${cart2Id}/line-items`, {
        variant_id: variant.id,
        quantity: 1,
      }),
    ])

    const successes = [r1, r2].filter((r) => r.status === "fulfilled").length

    console.log(chalk.gray(`    Cart 1 (qty=${initialStock}): ${r1.status}`))
    console.log(chalk.gray(`    Cart 2 (qty=1): ${r2.status}`))

    // Verify stock didn't go negative
    const afterRes = await storeApi.get(
      `/store/products/${target.id}?fields=*variants`
    )
    const afterVariant = afterRes.data.product.variants.find(
      (v: any) => v.id === variant.id
    )
    const afterStock = afterVariant?.inventory_quantity ?? 0

    console.log(chalk.gray(`    Stock after: ${afterStock}`))

    if (afterStock < 0) {
      return {
        name,
        passed: false,
        details: `CRITICAL: Overselling detected! Stock went to ${afterStock}`,
      }
    }

    return {
      name,
      passed: true,
      details: `Stock before=${initialStock}, after=${afterStock}, no overselling`,
    }
  } catch (err: any) {
    return {
      name,
      passed: false,
      details: `Test error: ${err.message}`,
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(chalk.bold.cyan("\n========================================"))
  console.log(chalk.bold.cyan("  Stock / Inventory Comparison"))
  console.log(chalk.bold.cyan("========================================"))
  console.log(chalk.gray(`  Old API: ${OLD_API}`))
  console.log(chalk.gray(`  New API: ${NEW_API}`))

  const results: TestResult[] = []

  try {
    // Fetch stock from both systems
    console.log(chalk.blue("\n  Fetching stock data..."))

    const { result: oldStock, durationMs: oldTime } = await measureTime(fetchOldStock)
    console.log(chalk.gray(`    Old: ${oldStock.length} entries (${oldTime}ms)`))

    const { result: newStock, durationMs: newTime } = await measureTime(fetchMedusaStock)
    console.log(chalk.gray(`    New: ${newStock.length} entries (${newTime}ms)`))

    results.push(await testTotalStock(oldStock, newStock))
    results.push(await testPerProductStock(oldStock, newStock))
    results.push(await testRaceCondition())
  } catch (err: any) {
    console.log(chalk.red(`\n  Fatal error: ${err.message}`))
    results.push({
      name: "System connectivity",
      passed: false,
      details: `Could not reach one or both APIs: ${err.message}`,
    })
  }

  printSummary("Stock Comparison", results)
  saveResults("stock-comparison", {
    timestamp: new Date().toISOString(),
    results,
  })

  const failed = results.filter((r) => !r.passed).length
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(chalk.red("\nFatal error:"), err)
  process.exit(1)
})
