/**
 * Parallel API Comparison Test: Orders
 *
 * Compares order migration completeness between the ID map (ground truth from
 * the migration scripts) and the new Medusa system.
 *
 * Old system source of truth: migration_id_map table (864 order mappings)
 * New Medusa:  GET /admin/orders → { orders, count, offset, limit }
 *
 * Note: Old Express admin API uses Google OAuth (no password), so we use the
 * ID map (populated by migration script 08) as the authoritative record count.
 */

import chalk from "chalk"
import * as dotenv from "dotenv"
import { normalizeOrder } from "./utils/normalize"
import { medusaAdminClient } from "./utils/auth"
import { loadIdMap, IdMapping } from "./utils/id-map"
import { printSummary, saveResults, measureTime, TestResult } from "./utils/reporter"

dotenv.config()

// ── Fetch Medusa orders only ───────────────────────────────────────────

async function fetchMedusaOrders(): Promise<any[]> {
  const client = await medusaAdminClient()
  const all: any[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const res = await client.get(`/admin/orders?limit=${limit}&offset=${offset}&fields=id,display_id,status,total,currency_code,created_at,*items`)
    const orders = res.data.orders || []
    all.push(...orders)

    if (orders.length < limit) break
    offset += limit
  }

  return all
}

// ── Test 1: Order count (Medusa vs ID map) ────────────────────────────

function testOrderCount(
  idMapSize: number,
  medusaOrders: any[]
): TestResult {
  const name = "Order count matches"

  console.log(chalk.blue("\n  Order counts:"))
  console.log(chalk.gray(`    ID map (migrated from old): ${idMapSize}`))
  console.log(chalk.gray(`    New Medusa:                 ${medusaOrders.length}`))

  const diff = Math.abs(idMapSize - medusaOrders.length)

  if (diff === 0) {
    return { name, passed: true, details: `Exact match: ${medusaOrders.length} orders` }
  }

  const variance = diff / Math.max(idMapSize, 1)
  if (variance < 0.02) {
    return {
      name,
      passed: true,
      details: `Diff: ${diff} orders (${(variance * 100).toFixed(1)}% variance — within 2% tolerance)`,
    }
  }

  return {
    name,
    passed: false,
    details: `Diff: ${diff} orders (${(variance * 100).toFixed(1)}% variance)`,
  }
}

// ── Test 2: All mapped Medusa UUIDs exist in Medusa ───────────────────

async function testOrderDataParity(
  medusaOrders: any[],
  idMap: IdMapping
): Promise<TestResult> {
  const name = "Order data parity (ID map coverage)"

  const medusaById = new Map<string, any>()
  for (const o of medusaOrders) {
    medusaById.set(o.id, o)
  }

  let found = 0
  let missing = 0
  const missingSample: string[] = []

  // Sample up to 50 IDs from map to check
  const entries = [...idMap.entries()].slice(0, 50)
  for (const [oldId, newId] of entries) {
    if (medusaById.has(newId)) {
      found++
    } else {
      missing++
      if (missingSample.length < 5) missingSample.push(`old:${oldId}→new:${newId}`)
    }
  }

  console.log(chalk.blue("\n  ID map coverage check (sample of 50):"))
  console.log(chalk.green(`    Found in Medusa: ${found}/50`))
  if (missing > 0) {
    console.log(chalk.yellow(`    Missing:         ${missing}/50`))
    console.log(chalk.gray(`    Sample: ${missingSample.join(", ")}`))
  }

  return {
    name,
    passed: found / 50 >= 0.95,
    details: `${found}/50 sampled orders found in Medusa (${((found / 50) * 100).toFixed(1)}%)`,
  }
}

// ── Test 3: No orphaned orders (all map entries exist in Medusa) ───────

async function testNoOrphans(
  medusaOrders: any[],
  idMap: IdMapping
): Promise<TestResult> {
  const name = "No orphaned orders"

  const medusaIds = new Set(medusaOrders.map((o) => o.id))
  let mapped = 0
  let unmapped = 0
  const unmappedSample: string[] = []

  for (const [, newId] of idMap) {
    if (medusaIds.has(newId)) {
      mapped++
    } else {
      unmapped++
      if (unmappedSample.length < 5) unmappedSample.push(newId)
    }
  }

  console.log(chalk.blue("\n  Orphan check (all mapped → exists in Medusa):"))
  console.log(chalk.green(`    Mapped & found: ${mapped}/${idMap.size}`))
  if (unmapped > 0) {
    console.log(chalk.yellow(`    Not found in Medusa: ${unmapped}`))
    console.log(chalk.gray(`    Sample: ${unmappedSample.join(", ")}`))
  }

  return {
    name,
    passed: unmapped === 0,
    details: `${mapped}/${idMap.size} order mappings verified in Medusa`,
  }
}

// ── Test 4: Order status distribution ──────────────────────────────────

function testStatusDistribution(
  medusaOrders: any[]
): TestResult {
  const name = "Order status distribution (Medusa)"

  const statuses = new Map<string, number>()
  for (const o of medusaOrders) {
    const norm = normalizeOrder("medusa", o)
    statuses.set(norm.status, (statuses.get(norm.status) || 0) + 1)
  }

  console.log(chalk.blue("\n  Order status distribution (Medusa):"))
  for (const [status, count] of [...statuses.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = ((count / medusaOrders.length) * 100).toFixed(1)
    console.log(chalk.gray(`    ${status.padEnd(15)} ${String(count).padStart(4)} (${pct}%)`))
  }

  return {
    name,
    passed: true,
    details: `${statuses.size} distinct statuses across ${medusaOrders.length} orders`,
    data: Object.fromEntries(statuses),
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(chalk.bold.cyan("\n========================================"))
  console.log(chalk.bold.cyan("  Order API Comparison"))
  console.log(chalk.bold.cyan("========================================"))

  const results: TestResult[] = []

  try {
    // Load ID map (source of truth: 864 orders migrated)
    console.log(chalk.blue("\n  Loading migration ID map..."))
    const idMap = await loadIdMap("orders")
    console.log(chalk.gray(`    ${idMap.size} order ID mappings loaded`))

    // Fetch Medusa orders only (old Express admin uses Google OAuth — no password)
    console.log(chalk.blue("\n  Fetching Medusa orders..."))

    const { result: medusaOrders, durationMs: newTime } = await measureTime(fetchMedusaOrders)
    console.log(chalk.gray(`    Medusa: ${medusaOrders.length} orders (${newTime}ms)`))

    // Run tests
    results.push(testOrderCount(idMap.size, medusaOrders))
    results.push(await testOrderDataParity(medusaOrders, idMap))
    results.push(await testNoOrphans(medusaOrders, idMap))
    results.push(testStatusDistribution(medusaOrders))
  } catch (err: any) {
    console.log(chalk.red(`\n  Fatal error: ${err.message}`))
    results.push({
      name: "System connectivity / auth",
      passed: false,
      details: err.message,
    })
  }

  printSummary("Order Comparison", results)
  saveResults("order-comparison", {
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
