/**
 * SCRIPT 09: Migrate Payments
 *
 * Purpose:
 * - Migrate 863 payments from MySQL → Medusa v2 payment tables
 * - Each old payment becomes: payment_collection + payment_session + payment + order_payment_collection
 * - Preserves Razorpay transaction IDs, payment_data, paid_at, etc. in metadata/data
 *
 * Source: MySQL `payments` table (863 rows)
 * Statuses: paid=523, failed=309, pending=27, refunded=4
 *
 * Target tables (Medusa v2):
 * - `payment_collection`       — umbrella for all payments on an order
 * - `payment_session`          — the attempt / session (one per payment)
 * - `payment`                  — the actual captured/failed payment
 * - `order_payment_collection` — join between order and payment_collection
 *
 * Payment provider mapping:
 *   RAZORPAY  → "pp_razorpay_razorpay"
 *   OFFLINE   → "pp_system_default"
 *   default   → "pp_system_default"
 *
 * Status mapping:
 *   paid      → collection: completed, session: authorized, payment: captured_at SET
 *   failed    → collection: canceled,  session: error,      payment: canceled_at SET
 *   pending   → collection: not_paid,  session: pending,    payment: (no capture/cancel)
 *   refunded  → collection: completed, session: authorized, payment: captured_at SET (refund tracked in metadata)
 *
 * Complexity: ⭐⭐⭐ HIGH (4 tables, JSONB raw_ fields, FK chain)
 * Duration: ~1-2 minutes
 *
 * Run: npm run script:09
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
const CURRENCY_CODE = 'inr'

// ============================================================================
// TYPES
// ============================================================================

interface OldPayment {
  id: number
  order_id: number
  payment_method: string
  transaction_id: string | null
  amount: string
  status: string
  payment_gateway: string | null
  payment_data: string | null
  paid_at: Date | null
  created_at: Date
  updated_at: Date
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

function rawAmount(value: string | number): object {
  return { value: String(value), precision: 20 }
}

/**
 * Map old payment_gateway → Medusa provider_id
 */
function mapProviderId(gateway: string | null, method: string | null): string {
  const g = (gateway || '').toUpperCase()
  const m = (method || '').toUpperCase()
  if (g === 'RAZORPAY' || m.includes('UPI') || m.includes('RAZORPAY')) {
    // Only use razorpay provider if it was an actual Razorpay transaction
    if (g === 'RAZORPAY') return 'pp_razorpay_razorpay'
  }
  return 'pp_system_default'
}

/**
 * payment_collection.status values used by Medusa:
 * "not_paid" | "awaiting" | "authorized" | "partially_authorized" |
 * "captured" | "partially_captured" | "canceled" | "completed"
 */
function mapCollectionStatus(oldStatus: string): string {
  switch (oldStatus) {
    case 'paid':      return 'completed'
    case 'refunded':  return 'completed'
    case 'failed':    return 'canceled'
    case 'pending':   return 'not_paid'
    default:          return 'not_paid'
  }
}

/**
 * payment_session.status: "pending" | "authorized" | "requires_more" | "error" | "canceled"
 */
function mapSessionStatus(oldStatus: string): string {
  switch (oldStatus) {
    case 'paid':      return 'authorized'
    case 'refunded':  return 'authorized'
    case 'failed':    return 'error'
    case 'pending':   return 'pending'
    default:          return 'pending'
  }
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

async function migratePayments(mysqlConnection: any, pgClient: PgClient): Promise<void> {
  console.log('\n💳 Starting payment migration...\n')

  // ── Load source data ──────────────────────────────────────────────────────
  console.log('📥 Reading MySQL payments...')
  const [rows] = await mysqlConnection.query('SELECT * FROM payments ORDER BY id ASC')
  const payments = rows as OldPayment[]
  console.log(`   Found ${payments.length} payments`)

  // ── Load order ID mappings ────────────────────────────────────────────────
  console.log('📥 Loading order ID mappings...')
  const orderRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'orders' AND new_table = 'order'`
  )
  const orderIdMap = new Map<number, string>()
  for (const r of orderRes.rows) orderIdMap.set(r.old_id, r.new_id)
  console.log(`   ${orderIdMap.size} order mappings loaded`)

  // ── Ensure payment providers exist ───────────────────────────────────────
  console.log('📥 Ensuring payment providers exist...')
  for (const providerId of ['pp_system_default', 'pp_razorpay_razorpay']) {
    await pgClient.query(
      `INSERT INTO payment_provider (id, is_enabled, created_at, updated_at)
       VALUES ($1, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [providerId]
    )
  }
  console.log('   ✅ Providers ready: pp_system_default, pp_razorpay_razorpay')

  // ── Process each payment ──────────────────────────────────────────────────
  console.log('\n💾 Inserting payments...')
  let inserted = 0
  let skippedNoOrder = 0

  for (const payment of payments) {
    const medusaOrderId = orderIdMap.get(payment.order_id)
    if (!medusaOrderId) {
      if (VERBOSE) console.log(`   ⚠️  Skipping payment ${payment.id} — order_id ${payment.order_id} not in order map`)
      skippedNoOrder++
      continue
    }

    const collectionId  = generateUUIDFromId('payment_collection', payment.id)
    const sessionId     = generateUUIDFromId('payment_session', payment.id)
    const paymentId     = generateUUIDFromId('payment', payment.id)
    const opcId         = generateUUIDFromId('order_payment_collection', payment.id)

    const amount        = parseFloat(payment.amount)
    const providerId    = mapProviderId(payment.payment_gateway, payment.payment_method)
    const collStatus    = mapCollectionStatus(payment.status)
    const sessStatus    = mapSessionStatus(payment.status)
    const isPaid        = payment.status === 'paid' || payment.status === 'refunded'
    const isFailed      = payment.status === 'failed'
    const capturedAt    = isPaid ? (payment.paid_at || payment.updated_at) : null
    const canceledAt    = isFailed ? payment.updated_at : null
    const completedAt   = isPaid ? (payment.paid_at || payment.updated_at) : null

    // Parse payment_data JSON safely
    let parsedPaymentData: Record<string, any> = {}
    if (payment.payment_data) {
      try { parsedPaymentData = JSON.parse(payment.payment_data) } catch { /* ignore */ }
    }

    const sessionData: Record<string, any> = {
      transactionId: payment.transaction_id,
      paymentMethod: payment.payment_method,
      paymentGateway: payment.payment_gateway,
      ...parsedPaymentData,
    }

    const paymentMetadata = {
      oldPaymentId: payment.id,
      oldOrderId: payment.order_id,
      paymentMethod: payment.payment_method,
      paymentGateway: payment.payment_gateway,
      transactionId: payment.transaction_id,
      oldStatus: payment.status,
      paidAt: payment.paid_at,
    }

    const capturedAmount   = isPaid  ? amount : 0
    const refundedAmount   = payment.status === 'refunded' ? amount : 0

    try {
      // 1. payment_collection
      await pgClient.query(
        `INSERT INTO payment_collection (
          id, currency_code, amount, raw_amount,
          authorized_amount, raw_authorized_amount,
          captured_amount, raw_captured_amount,
          refunded_amount, raw_refunded_amount,
          status, completed_at, metadata, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING`,
        [
          collectionId,
          CURRENCY_CODE,
          amount,      JSON.stringify(rawAmount(amount)),
          isPaid ? amount : 0, JSON.stringify(rawAmount(isPaid ? amount : 0)),
          capturedAmount,      JSON.stringify(rawAmount(capturedAmount)),
          refundedAmount,      JSON.stringify(rawAmount(refundedAmount)),
          collStatus,
          completedAt,
          JSON.stringify(paymentMetadata),
          payment.created_at,
          payment.updated_at,
        ]
      )

      // 2. payment_session
      await pgClient.query(
        `INSERT INTO payment_session (
          id, currency_code, amount, raw_amount,
          provider_id, data, status,
          authorized_at, payment_collection_id,
          metadata, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING`,
        [
          sessionId,
          CURRENCY_CODE,
          amount, JSON.stringify(rawAmount(amount)),
          providerId,
          JSON.stringify(sessionData),
          sessStatus,
          capturedAt,        // authorized_at = when payment was captured/confirmed
          collectionId,
          JSON.stringify({ oldPaymentId: payment.id }),
          payment.created_at,
          payment.updated_at,
        ]
      )

      // 3. payment
      await pgClient.query(
        `INSERT INTO payment (
          id, amount, raw_amount, currency_code,
          provider_id, data,
          captured_at, canceled_at,
          payment_collection_id, payment_session_id,
          metadata, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING`,
        [
          paymentId,
          amount, JSON.stringify(rawAmount(amount)),
          CURRENCY_CODE,
          providerId,
          JSON.stringify(sessionData),
          capturedAt,
          canceledAt,
          collectionId,
          sessionId,
          JSON.stringify(paymentMetadata),
          payment.created_at,
          payment.updated_at,
        ]
      )

      // 4. order_payment_collection (composite PK on order_id+payment_collection_id; id is NOT NULL varchar)
      await pgClient.query(
        `INSERT INTO order_payment_collection (id, order_id, payment_collection_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (order_id, payment_collection_id) DO NOTHING`,
        [opcId, medusaOrderId, collectionId, payment.created_at, payment.updated_at]
      )

      // 5. Save ID mapping
      await pgClient.query(
        `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (old_table, old_id) DO NOTHING`,
        ['payments', payment.id, 'payment_collection', collectionId]
      )

      inserted++
      if (VERBOSE && inserted % 100 === 0) {
        console.log(`   ... ${inserted} payments inserted`)
      }
    } catch (e: any) {
      console.error(`   ✗ Payment ${payment.id} failed:`, e.message)
      throw e
    }
  }

  console.log(`\n   ✅ ${inserted} payments inserted`)
  if (skippedNoOrder > 0) console.log(`   ⚠️  ${skippedNoOrder} skipped (no order mapping)`)

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\n🔍 Verifying...')
  const pc = await pgClient.query(`SELECT COUNT(*) FROM payment_collection WHERE deleted_at IS NULL`)
  const ps = await pgClient.query(`SELECT COUNT(*) FROM payment_session WHERE deleted_at IS NULL`)
  const pm = await pgClient.query(`SELECT COUNT(*) FROM payment WHERE deleted_at IS NULL`)
  const op = await pgClient.query(`SELECT COUNT(*) FROM order_payment_collection WHERE deleted_at IS NULL`)
  const mc = await pgClient.query(`SELECT COUNT(*) FROM migration_id_map WHERE old_table = 'payments'`)

  console.log(`   payment_collections:       ${pc.rows[0].count}`)
  console.log(`   payment_sessions:          ${ps.rows[0].count}`)
  console.log(`   payments:                  ${pm.rows[0].count}`)
  console.log(`   order_payment_collections: ${op.rows[0].count}`)
  console.log(`   ID mappings:               ${mc.rows[0].count}`)

  const statusBreakdown = await pgClient.query(
    `SELECT status, COUNT(*) as c FROM payment_collection WHERE deleted_at IS NULL GROUP BY status ORDER BY c DESC`
  )
  console.log('\n   Collection status breakdown:')
  for (const row of statusBreakdown.rows) {
    console.log(`     ${row.status.padEnd(20)} ${row.c}`)
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 09: Migrate Payments')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    await migratePayments(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ PAYMENT MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 10 (migrate stock events)')
    console.log('  npm run script:10\n')

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

export { migratePayments }
