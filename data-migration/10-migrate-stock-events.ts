/**
 * SCRIPT 10: Migrate Stock Events
 *
 * Purpose:
 * - Migrate 36 stock events from MySQL `stock_events` → custom PostgreSQL `stock_event` table
 * - Resolve old order_id → Medusa order UUID via migration_id_map
 * - Resolve old product_id → Medusa variant UUID via migration_id_map
 * - Preserve event_type, quantity, reason, source, metadata, timestamps
 *
 * Source: MySQL `stock_events` (36 rows: DEDUCTED/RESTORED/RESERVED/RELEASED)
 *
 * Target: Custom `stock_event` table (created in Script 01):
 *   id (text), order_id (text), variant_id (text), event_type (varchar),
 *   quantity (int), reason (varchar), source (varchar), metadata (jsonb),
 *   created_by (text), created_at (timestamp)
 *
 * Note: stock_movements table was empty (0 rows) — skipped.
 *
 * Complexity: ⭐ LOW (small table, custom target, straightforward mapping)
 * Duration: ~5 seconds
 *
 * Run: npm run script:10
 */

import { Client as PgClient } from 'pg'
import mysql from 'mysql2/promise'
import * as crypto from 'crypto'

// ============================================================================
// CONFIGURATION
// ============================================================================

const OLD_DB_CONFIG = {
  host: process.env.OLD_DB_HOST || 'yamabiko.proxy.rlwy.net',
  port: parseInt(process.env.OLD_DB_PORT || '45132'),
  user: process.env.OLD_DB_USER || 'root',
  password: process.env.OLD_DB_PASSWORD || 'dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf',
  database: process.env.OLD_DB_NAME || 'railway',
}

const NEW_DB_CONFIG = {
  host: process.env.NEW_DB_HOST || 'localhost',
  port: parseInt(process.env.NEW_DB_PORT || '5432'),
  user: process.env.NEW_DB_USER || 'prudhvi',
  password: process.env.NEW_DB_PASSWORD || 'Oldisgold%402026',
  database: process.env.NEW_DB_NAME || 'vaighaweaves_db_dev',
}

const VERBOSE = process.env.VERBOSE !== 'false'

// ============================================================================
// TYPES
// ============================================================================

interface OldStockEvent {
  id: number
  order_id: number
  event_type: string        // RESERVED | RELEASED | DEDUCTED | RESTORED
  product_id: number
  image_id: number | null
  variant_id: number | null
  size: string | null
  quantity: number
  reason: string
  source: string
  metadata: string | null   // JSON string
  created_at: Date
  created_by: number | null
}

// ============================================================================
// HELPERS
// ============================================================================

function generateUUIDFromId(tableName: string, oldId: number): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const text = `${tableName}:${oldId}`
  const hash = crypto.createHash('sha1').update(namespace + text).digest()
  const hex = hash.toString('hex')
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    '5' + hex.substring(13, 16),
    ((0x8 | (parseInt(hex[16], 16) & 0x3)).toString(16)) + hex.substring(17, 20),
    hex.substring(20, 32),
  ].join('-')
}

async function connectMySQL() {
  return mysql.createConnection(OLD_DB_CONFIG)
}

async function connectPostgreSQL() {
  const client = new PgClient(NEW_DB_CONFIG)
  await client.connect()
  return client
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrateStockEvents(mysqlConnection: any, pgClient: PgClient): Promise<void> {
  console.log('\n📊 Starting stock event migration...\n')

  // ── Load source data ──────────────────────────────────────────────────────
  console.log('📥 Reading MySQL stock_events...')
  const [rows] = await mysqlConnection.query('SELECT * FROM stock_events ORDER BY id ASC')
  const events = rows as OldStockEvent[]
  console.log(`   Found ${events.length} stock events`)

  if (events.length === 0) {
    console.log('   Nothing to migrate.')
    return
  }

  // Print type breakdown
  const typeCounts: Record<string, number> = {}
  for (const e of events) typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1
  for (const [t, c] of Object.entries(typeCounts)) console.log(`   ${t}: ${c}`)

  // ── Load ID mappings ──────────────────────────────────────────────────────
  console.log('\n📥 Loading ID mappings...')

  const orderRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'orders' AND new_table = 'order'`
  )
  const orderIdMap = new Map<number, string>()
  for (const r of orderRes.rows) orderIdMap.set(r.old_id, r.new_id)
  console.log(`   ${orderIdMap.size} order mappings`)

  // product_variants → product_variant (script 05 used 'product_variants' as old_table)
  const variantIdMap = new Map<number, string>()
  const varRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'product_variants' AND new_table = 'product_variant'`
  )
  for (const r of varRes.rows) variantIdMap.set(r.old_id, r.new_id)
  // Also load product_id → variant mapping (default variant shares product's old id)
  const varRes2 = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'products' AND new_table = 'product_variant'`
  )
  for (const r of varRes2.rows) {
    if (!variantIdMap.has(r.old_id)) variantIdMap.set(r.old_id, r.new_id)
  }
  console.log(`   ${variantIdMap.size} variant mappings`)

  // ── Load user ID mappings for created_by ─────────────────────────────────
  const userRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'users'`
  )
  const userIdMap = new Map<number, string>()
  for (const r of userRes.rows) userIdMap.set(r.old_id, r.new_id)
  console.log(`   ${userIdMap.size} user mappings`)

  // ── Insert stock events ───────────────────────────────────────────────────
  console.log('\n💾 Inserting stock events...')
  let inserted = 0
  let skipped = 0

  for (const event of events) {
    const newId        = generateUUIDFromId('stock_events', event.id)
    const medusaOrder  = orderIdMap.get(event.order_id) || null
    // variant: try direct variant_id first, fall back to product_id lookup
    const medusaVariant =
      (event.variant_id ? variantIdMap.get(event.variant_id) : null) ||
      variantIdMap.get(event.product_id) ||
      null

    // Parse metadata JSON
    let parsedMeta: Record<string, any> = {}
    if (event.metadata) {
      try { parsedMeta = JSON.parse(event.metadata) } catch { /* ignore */ }
    }

    // Enrich metadata with original fields
    const enrichedMeta = {
      ...parsedMeta,
      oldEventId: event.id,
      oldOrderId: event.order_id,
      oldProductId: event.product_id,
      oldImageId: event.image_id,
      oldVariantId: event.variant_id,
      size: event.size,
    }

    const createdByUserId = event.created_by ? (userIdMap.get(event.created_by) || null) : null

    try {
      await pgClient.query(
        `INSERT INTO stock_event (id, order_id, variant_id, event_type, quantity, reason, source, metadata, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          newId,
          medusaOrder,
          medusaVariant,
          event.event_type,
          event.quantity,
          event.reason,
          event.source,
          JSON.stringify(enrichedMeta),
          createdByUserId,
          event.created_at,
        ]
      )

      // Save ID mapping
      await pgClient.query(
        `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (old_table, old_id) DO NOTHING`,
        ['stock_events', event.id, 'stock_event', newId]
      )

      inserted++
      if (VERBOSE) {
        const orderLabel = medusaOrder ? medusaOrder.substring(0, 8) + '...' : 'no order'
        console.log(`   ✓ ${event.event_type.padEnd(10)} qty=${event.quantity} order=${orderLabel} reason=${event.reason}`)
      }
    } catch (e: any) {
      console.error(`   ✗ stock_event ${event.id} failed:`, e.message)
      throw e
    }
  }

  console.log(`\n   ✅ ${inserted} stock events inserted`)
  if (skipped > 0) console.log(`   ⚠️  ${skipped} skipped`)

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\n🔍 Verifying...')
  const cnt = await pgClient.query('SELECT COUNT(*) FROM stock_event')
  console.log(`   stock_event rows in PostgreSQL: ${cnt.rows[0].count}`)

  const typeBkdn = await pgClient.query(
    `SELECT event_type, COUNT(*) as c FROM stock_event GROUP BY event_type ORDER BY c DESC`
  )
  console.log('\n   Event type breakdown:')
  for (const row of typeBkdn.rows) {
    console.log(`     ${row.event_type.padEnd(15)} ${row.c}`)
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 10: Migrate Stock Events')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    await migrateStockEvents(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ STOCK EVENT MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 11 (migrate shipments)')
    console.log('  npm run script:11\n')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error)
    process.exit(1)
  } finally {
    if (mysqlConnection) await mysqlConnection.end()
    if (pgClient) await pgClient.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}

export { migrateStockEvents }
