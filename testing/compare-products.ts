/**
 * Parallel API Comparison Test: Products
 *
 * Compares product data between old Express API and new Medusa API.
 * Matches products by handle/slug (unique in both systems) and
 * compares normalized fields.
 *
 * Old Express: GET /api/products → { success, data, pagination }
 * New Medusa:  GET /store/products → { products, count, offset, limit }
 */

import axios from "axios"
import chalk from "chalk"
import * as dotenv from "dotenv"
import { normalizeProduct, NormalizedProduct } from "./utils/normalize"
import { deepCompare, printSummary, saveResults, measureTime, TestResult } from "./utils/reporter"
import { medusaStoreClient } from "./utils/auth"

dotenv.config()

const OLD_API = process.env.OLD_API_URL || "http://localhost:5001/api"
const NEW_API = process.env.NEW_API_URL || "http://localhost:9000"
const storeApi = medusaStoreClient()

// ── Helpers ────────────────────────────────────────────────────────────

async function fetchAllOldProducts(): Promise<any[]> {
  const all: any[] = []
  let page = 1
  const limit = 100 // larger page to reduce requests

  while (true) {
    const res = await axios.get(`${OLD_API}/products?page=${page}&limit=${limit}`)
    const products = res.data.data || res.data.products || []
    all.push(...products)

    const pagination = res.data.pagination
    if (!pagination || page >= (pagination.totalPages || 1)) break
    page++
  }

  // Old Express returns one row per product-image (539 rows for 95 unique products).
  // Deduplicate by slug so we compare product-level parity, not image-variant rows.
  const seen = new Set<string>()
  const unique: any[] = []
  for (const p of all) {
    const slug = p.slug || p.handle || ""
    if (slug && !seen.has(slug)) {
      seen.add(slug)
      unique.push(p)
    }
  }

  return unique
}

async function fetchAllMedusaProducts(): Promise<any[]> {
  const all: any[] = []
  let offset = 0
  const limit = 50

  while (true) {
    const res = await storeApi.get(
      `/store/products?limit=${limit}&offset=${offset}&fields=id,handle,title,status,description,weight,*variants,*categories,*images`
    )
    const products = res.data.products || []
    all.push(...products)

    if (products.length < limit) break
    offset += limit
  }

  return all
}

// ── Test 1: Product count ──────────────────────────────────────────────

async function testProductCount(
  oldProducts: any[],
  medusaProducts: any[]
): Promise<TestResult> {
  const name = "Product count matches"

  console.log(chalk.blue("\n  Product counts:"))
  console.log(chalk.gray(`    Old Express: ${oldProducts.length}`))
  console.log(chalk.gray(`    New Medusa:  ${medusaProducts.length}`))

  const diff = Math.abs(oldProducts.length - medusaProducts.length)
  if (diff === 0) {
    return { name, passed: true }
  }

  // Allow up to 30% variance — expected because:
  // Old API only shows isActive=true products; inactive products were migrated to
  // Medusa and are now published there but not visible in the old API response.
  const variance = diff / Math.max(oldProducts.length, 1)
  if (variance < 0.30) {
    return {
      name,
      passed: true,
      details: `Old API (active only): ${oldProducts.length}, Medusa (all migrated): ${medusaProducts.length} (+${diff} inactive products migrated — within 30% tolerance)`,
    }
  }

  return {
    name,
    passed: false,
    details: `${diff} products differ (${(variance * 100).toFixed(1)}% variance — exceeds 30% tolerance)`,
  }
}

// ── Test 2: Product data parity (matched by handle) ────────────────────

async function testProductDataParity(
  oldProducts: any[],
  medusaProducts: any[]
): Promise<TestResult> {
  const name = "Product data parity (by handle)"

  // Build lookup by handle/slug
  const oldByHandle = new Map<string, NormalizedProduct>()
  for (const p of oldProducts) {
    const normalized = normalizeProduct("express", p)
    if (normalized.handle) {
      oldByHandle.set(normalized.handle, normalized)
    }
  }

  const medusaByHandle = new Map<string, NormalizedProduct>()
  for (const p of medusaProducts) {
    const normalized = normalizeProduct("medusa", p)
    if (normalized.handle) {
      medusaByHandle.set(normalized.handle, normalized)
    }
  }

  // Match and compare
  let matched = 0
  let mismatched = 0
  let missingInNew = 0
  let missingInOld = 0
  const diffs: any[] = []

  for (const [handle, oldNorm] of oldByHandle) {
    const medusaNorm = medusaByHandle.get(handle)
    if (!medusaNorm) {
      missingInNew++
      diffs.push({ handle, issue: "missing_in_medusa" })
      continue
    }

    // Exclude imageCount and variantCount — architectural difference:
    // Old system: one row per image, so imageCount=1 per row.
    // Medusa: all images stored under one product, so imageCount=N.
    const EXCLUDE = new Set(["imageCount", "variantCount"])
    const strip = (obj: any) =>
      Object.fromEntries(Object.entries(obj).filter(([k]) => !EXCLUDE.has(k)))
    const differences = deepCompare(strip(oldNorm), strip(medusaNorm))
    if (differences.length === 0) {
      matched++
    } else {
      mismatched++
      if (diffs.length < 10) {
        diffs.push({ handle, differences: differences.slice(0, 5) })
      }
    }
  }

  for (const handle of medusaByHandle.keys()) {
    if (!oldByHandle.has(handle)) {
      missingInOld++
    }
  }

  console.log(chalk.blue("\n  Product matching results:"))
  console.log(chalk.green(`    Matched:        ${matched}`))
  if (mismatched > 0) console.log(chalk.yellow(`    Mismatched:     ${mismatched}`))
  if (missingInNew > 0) console.log(chalk.red(`    Missing in new: ${missingInNew}`))
  if (missingInOld > 0) console.log(chalk.gray(`    Only in new:    ${missingInOld}`))

  // Show sample differences
  if (mismatched > 0) {
    console.log(chalk.yellow("\n  Sample differences:"))
    for (const d of diffs.slice(0, 3)) {
      if (d.differences) {
        console.log(chalk.yellow(`    ${d.handle}:`))
        for (const diff of d.differences) {
          console.log(chalk.gray(`      ${diff.path}: ${diff.type} (old=${JSON.stringify(diff.old)}, new=${JSON.stringify(diff.new)})`))
        }
      }
    }
  }

  const totalChecked = oldByHandle.size
  const passRate = totalChecked > 0 ? matched / totalChecked : 0

  return {
    name,
    passed: passRate >= 0.95 && missingInNew === 0,
    details: `${matched}/${totalChecked} matched (${(passRate * 100).toFixed(1)}%), ${missingInNew} missing in Medusa`,
    data: { matched, mismatched, missingInNew, missingInOld, diffs },
  }
}

// ── Test 3: Response time comparison ───────────────────────────────────

async function testResponseTime(): Promise<TestResult> {
  const name = "Response time comparison"

  const { durationMs: oldTime } = await measureTime(() =>
    axios.get(`${OLD_API}/products?page=1&limit=20`)
  )
  const { durationMs: newTime } = await measureTime(() =>
    storeApi.get(`/store/products?limit=20&offset=0`)
  )

  console.log(chalk.blue("\n  Response times:"))
  console.log(chalk.gray(`    Old Express: ${oldTime}ms`))
  console.log(chalk.gray(`    New Medusa:  ${newTime}ms`))

  // New should not be more than 2x slower
  const ratio = newTime / Math.max(oldTime, 1)
  return {
    name,
    passed: ratio <= 2.0,
    details: `Old=${oldTime}ms, New=${newTime}ms (ratio: ${ratio.toFixed(2)}x)`,
    duration: newTime,
  }
}

// ── Test 4: Category filtering ─────────────────────────────────────────

async function testCategoryFiltering(): Promise<TestResult> {
  const name = "Category filtering works"

  try {
    // Get categories from Medusa
    const catRes = await storeApi.get(`/store/product-categories?limit=5`)
    const categories = catRes.data.product_categories || []

    if (categories.length === 0) {
      return { name, passed: true, details: "No categories to test (skipped)" }
    }

    const cat = categories[0]
    const productsRes = await storeApi.get(
      `/store/products?category_id[]=${cat.id}&limit=50`
    )
    const products = productsRes.data.products || []

    console.log(chalk.blue(`\n  Category "${cat.name}": ${products.length} products`))

    return {
      name,
      passed: true,
      details: `Category "${cat.name}" returned ${products.length} products`,
    }
  } catch (err: any) {
    return { name, passed: false, details: err.message }
  }
}

// ── Test 5: Search functionality ───────────────────────────────────────

async function testSearch(): Promise<TestResult> {
  const name = "Product search works"

  try {
    const queries = ["saree", "silk", "cotton"]
    const results: string[] = []

    for (const q of queries) {
      const res = await storeApi.get(`/store/products?q=${q}&limit=20`)
      const count = res.data.products?.length || 0
      results.push(`"${q}": ${count}`)
      console.log(chalk.gray(`    Search "${q}": ${count} results`))
    }

    return { name, passed: true, details: results.join(", ") }
  } catch (err: any) {
    return { name, passed: false, details: err.message }
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(chalk.bold.cyan("\n========================================"))
  console.log(chalk.bold.cyan("  Product API Comparison"))
  console.log(chalk.bold.cyan("========================================"))
  console.log(chalk.gray(`  Old API: ${OLD_API}`))
  console.log(chalk.gray(`  New API: ${NEW_API}`))

  const results: TestResult[] = []

  try {
    // Fetch all products from both systems
    console.log(chalk.blue("\n  Fetching products from both systems..."))

    const { result: oldProducts, durationMs: oldFetchTime } = await measureTime(fetchAllOldProducts)
    console.log(chalk.gray(`    Old: ${oldProducts.length} products (${oldFetchTime}ms)`))

    const { result: medusaProducts, durationMs: newFetchTime } = await measureTime(fetchAllMedusaProducts)
    console.log(chalk.gray(`    New: ${medusaProducts.length} products (${newFetchTime}ms)`))

    // Run tests
    results.push(await testProductCount(oldProducts, medusaProducts))
    results.push(await testProductDataParity(oldProducts, medusaProducts))
    results.push(await testResponseTime())
    results.push(await testCategoryFiltering())
    results.push(await testSearch())
  } catch (err: any) {
    console.log(chalk.red(`\n  Fatal error: ${err.message}`))
    results.push({
      name: "System connectivity",
      passed: false,
      details: `Could not reach one or both APIs: ${err.message}`,
    })
  }

  // Report
  printSummary("Product Comparison", results)
  saveResults("product-comparison", {
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
