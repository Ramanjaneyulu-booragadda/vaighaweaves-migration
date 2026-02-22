/**
 * SCRIPT 11: Migrate Shipments
 *
 * Purpose:
 * - Migrate shipments from MySQL `shipments` → Medusa v2 `fulfillment` tables
 * - Creates: fulfillment + fulfillment_label (if tracking) + fulfillment_item (per order item)
 *            + order_fulfillment (join) + fulfillment_address (delivery address snapshot)
 *
 * Source: MySQL `shipments` table
 * Count at migration time: 0 rows (no shipments created yet in old system)
 *
 * Medusa target tables:
 * - `fulfillment`          — the shipment record (carrier, timestamps, provider)
 * - `fulfillment_label`    — tracking number + label URL
 * - `fulfillment_item`     — line items included in fulfillment
 * - `fulfillment_address`  — delivery address snapshot
 * - `order_fulfillment`    — join between order and fulfillment
 *
 * Carrier → Medusa fulfillment_provider mapping:
 *   india_post    → "fp_india_post"
 *   delhivery     → "fp_delhivery"
 *   bluedart      → "fp_bluedart"
 *   dtdc          → "fp_dtdc"
 *   ecom_express  → "fp_ecom_express"
 *   xpressbees    → "fp_xpressbees"
 *   manual        → "fp_manual"
 *
 * Status mapping:
 *   delivered            → delivered_at SET
 *   in_transit / picked_up / out_for_delivery → shipped_at SET
 *   shipment_cancelled   → canceled_at SET
 *   booked / label_generated / pickup_scheduled → packed_at SET
 *   pending / booking_failed → (no timestamps)
 *
 * Complexity: ⭐⭐⭐ MEDIUM-HIGH (5 tables, but 0 rows currently)
 * Duration: ~5 seconds (no-op for empty source)
 *
 * Run: npm run script:11
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

interface OldShipment {
  id: number
  order_id: number
  carrier: string
  service_type: string
  tracking_number: string | null
  carrier_tracking_url: string | null
  carrier_booking_ref_id: string | null
  carrier_batch_id: string | null
  weight_grams: number
  length_cm: string | null
  width_cm: string | null
  height_cm: string | null
  volumetric_weight_grams: number | null
  chargeable_weight_grams: number | null
  base_tariff: string | null
  gst_amount: string | null
  cod_charges: string | null
  insurance_charges: string | null
  total_tariff: string | null
  sender_name: string
  sender_phone: string
  sender_address: string
  sender_city: string
  sender_state: string
  sender_pincode: string
  receiver_name: string
  receiver_phone: string
  receiver_address: string
  receiver_city: string
  receiver_state: string
  receiver_pincode: string
  status: string
  current_location: string | null
  last_event_at: Date | null
  estimated_delivery_date: Date | null
  actual_delivery_date: Date | null
  delivery_attempts: number
  last_attempt_reason: string | null
  label_url: string | null
  label_generated_at: Date | null
  manifest_url: string | null
  pickup_mode: string | null
  pickup_scheduled_date: Date | null
  picked_up_at: Date | null
  manual_carrier_name: string | null
  manual_notes: string | null
  booking_response: string | null
  last_api_error: string | null
  booked_by_id: number | null
  booked_at: Date | null
  created_at: Date
  updated_at: Date
  correlation_id: string | null
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

function rawAmount(value: number): object {
  return { value: String(value), precision: 20 }
}

function mapProviderId(carrier: string): string {
  const map: Record<string, string> = {
    india_post:   'fp_india_post',
    delhivery:    'fp_delhivery',
    bluedart:     'fp_bluedart',
    dtdc:         'fp_dtdc',
    ecom_express: 'fp_ecom_express',
    xpressbees:   'fp_xpressbees',
    manual:       'fp_manual',
  }
  return map[carrier] || 'fp_manual'
}

function mapTimestamps(status: string, shipment: OldShipment) {
  const delivered = ['delivered'].includes(status)
    ? (shipment.actual_delivery_date || shipment.updated_at) : null
  const shipped = ['in_transit', 'picked_up', 'out_for_delivery', 'delivery_attempted',
    'rto_initiated', 'rto_in_transit', 'rto_delivered'].includes(status)
    ? (shipment.picked_up_at || shipment.booked_at || shipment.updated_at) : null
  const packed = ['booked', 'label_generated', 'pickup_scheduled'].includes(status)
    ? (shipment.booked_at || shipment.updated_at) : null
  const canceled = ['shipment_cancelled', 'lost', 'damaged'].includes(status)
    ? shipment.updated_at : null
  // Delivered implies also shipped+packed
  return {
    delivered_at: delivered,
    shipped_at:   delivered ? (shipment.picked_up_at || shipment.booked_at || shipment.updated_at) : shipped,
    packed_at:    delivered || shipped ? (shipment.booked_at || shipment.updated_at) : packed,
    canceled_at:  canceled,
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
// ENSURE FULFILLMENT PROVIDERS
// ============================================================================

async function ensureProviders(pgClient: PgClient, carriers: string[]): Promise<void> {
  const providerIds = [...new Set(carriers.map(mapProviderId))]
  for (const pid of providerIds) {
    await pgClient.query(
      `INSERT INTO fulfillment_provider (id, is_enabled, created_at, updated_at)
       VALUES ($1, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [pid]
    )
  }
  if (providerIds.length > 0) {
    console.log(`   ✅ Providers ensured: ${providerIds.join(', ')}`)
  }
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrateShipments(mysqlConnection: any, pgClient: PgClient): Promise<void> {
  console.log('\n🚚 Starting shipment migration...\n')

  // ── Load source data ──────────────────────────────────────────────────────
  console.log('📥 Reading MySQL shipments...')
  const [rows] = await mysqlConnection.query('SELECT * FROM shipments ORDER BY id ASC')
  const shipments = rows as OldShipment[]
  console.log(`   Found ${shipments.length} shipments`)

  if (shipments.length === 0) {
    console.log('\n   ℹ️  No shipments to migrate — source table is empty.')
    console.log('   This is expected: shipments were tracked on orders directly in the old system.')
    console.log('   Tracking numbers are preserved in order.metadata.trackingNumber')
    return
  }

  // ── Load ID mappings ──────────────────────────────────────────────────────
  console.log('📥 Loading ID mappings...')

  const orderRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'orders' AND new_table = 'order'`
  )
  const orderIdMap = new Map<number, string>()
  for (const r of orderRes.rows) orderIdMap.set(r.old_id, r.new_id)

  const lineItemRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'order_items' AND new_table = 'order_line_item'`
  )
  const lineItemIdMap = new Map<number, string>()
  for (const r of lineItemRes.rows) lineItemIdMap.set(r.old_id, r.new_id)

  // ── Ensure fulfillment providers ─────────────────────────────────────────
  const uniqueCarriers = [...new Set(shipments.map(s => s.carrier))]
  await ensureProviders(pgClient, uniqueCarriers)

  // ── Get default stock location (needed for fulfillment.location_id) ──────
  const locRes = await pgClient.query(
    `SELECT id FROM stock_location ORDER BY created_at ASC LIMIT 1`
  )
  const locationId = locRes.rows[0]?.id
  if (!locationId) {
    throw new Error('No stock_location found. Run Medusa setup first.')
  }
  console.log(`   Using stock location: ${locationId}`)

  // ── Process each shipment ─────────────────────────────────────────────────
  console.log('\n💾 Inserting shipments...')
  let inserted = 0
  let skipped = 0

  for (const shipment of shipments) {
    const medusaOrderId = orderIdMap.get(shipment.order_id)
    if (!medusaOrderId) {
      if (VERBOSE) console.log(`   ⚠️  Skipping shipment ${shipment.id} — order ${shipment.order_id} not mapped`)
      skipped++
      continue
    }

    const fulfillmentId  = generateUUIDFromId('shipments', shipment.id)
    const fulfillAddrId  = generateUUIDFromId('shipment_address', shipment.id)
    const ofJoinId       = generateUUIDFromId('order_fulfillment', shipment.id)
    const providerId     = mapProviderId(shipment.carrier)
    const timestamps     = mapTimestamps(shipment.status, shipment)

    // Parse booking_response safely
    let bookingResponse: Record<string, any> = {}
    if (shipment.booking_response) {
      try { bookingResponse = JSON.parse(shipment.booking_response) } catch { /* ignore */ }
    }

    const metadata = {
      oldShipmentId: shipment.id,
      oldOrderId: shipment.order_id,
      carrier: shipment.carrier,
      serviceType: shipment.service_type,
      bookingRefId: shipment.carrier_booking_ref_id,
      batchId: shipment.carrier_batch_id,
      status: shipment.status,
      currentLocation: shipment.current_location,
      lastEventAt: shipment.last_event_at,
      estimatedDeliveryDate: shipment.estimated_delivery_date,
      deliveryAttempts: shipment.delivery_attempts,
      lastAttemptReason: shipment.last_attempt_reason,
      weightGrams: shipment.weight_grams,
      volumetricWeightGrams: shipment.volumetric_weight_grams,
      chargeableWeightGrams: shipment.chargeable_weight_grams,
      dimensions: {
        length_cm: shipment.length_cm,
        width_cm: shipment.width_cm,
        height_cm: shipment.height_cm,
      },
      tariff: {
        baseTariff: shipment.base_tariff,
        gstAmount: shipment.gst_amount,
        codCharges: shipment.cod_charges,
        insuranceCharges: shipment.insurance_charges,
        totalTariff: shipment.total_tariff,
      },
      sender: {
        name: shipment.sender_name,
        phone: shipment.sender_phone,
        address: shipment.sender_address,
        city: shipment.sender_city,
        state: shipment.sender_state,
        pincode: shipment.sender_pincode,
      },
      pickupMode: shipment.pickup_mode,
      pickupScheduledDate: shipment.pickup_scheduled_date,
      pickedUpAt: shipment.picked_up_at,
      manifestUrl: shipment.manifest_url,
      manualCarrierName: shipment.manual_carrier_name,
      manualNotes: shipment.manual_notes,
      lastApiError: shipment.last_api_error,
      correlationId: shipment.correlation_id,
      bookingResponse,
    }

    try {
      // 1. fulfillment_address (receiver address snapshot)
      const [rcvrFirst, ...rcvrRest] = (shipment.receiver_name || '').trim().split(/\s+/)
      await pgClient.query(
        `INSERT INTO fulfillment_address (id, first_name, last_name, address_1, city, province, postal_code, country_code, phone, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'in',$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          fulfillAddrId,
          rcvrFirst || '',
          rcvrRest.join(' ') || '',
          shipment.receiver_address,
          shipment.receiver_city,
          shipment.receiver_state,
          shipment.receiver_pincode,
          shipment.receiver_phone,
          shipment.created_at,
          shipment.updated_at,
        ]
      )

      // 2. fulfillment
      await pgClient.query(
        `INSERT INTO fulfillment (id, location_id, provider_id, delivery_address_id,
           packed_at, shipped_at, delivered_at, canceled_at,
           data, metadata, requires_shipping, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12)
         ON CONFLICT (id) DO NOTHING`,
        [
          fulfillmentId,
          locationId,
          providerId,
          fulfillAddrId,
          timestamps.packed_at,
          timestamps.shipped_at,
          timestamps.delivered_at,
          timestamps.canceled_at,
          JSON.stringify({ carrier: shipment.carrier, serviceType: shipment.service_type }),
          JSON.stringify(metadata),
          shipment.created_at,
          shipment.updated_at,
        ]
      )

      // 3. fulfillment_label (if tracking number exists)
      if (shipment.tracking_number) {
        const labelId = generateUUIDFromId('shipment_label', shipment.id)
        await pgClient.query(
          `INSERT INTO fulfillment_label (id, tracking_number, tracking_url, label_url, fulfillment_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO NOTHING`,
          [
            labelId,
            shipment.tracking_number,
            shipment.carrier_tracking_url || '',
            shipment.label_url || '',
            fulfillmentId,
            shipment.label_generated_at || shipment.created_at,
            shipment.updated_at,
          ]
        )
      }

      // 4. order_fulfillment join (composite PK: order_id + fulfillment_id; id NOT NULL)
      await pgClient.query(
        `INSERT INTO order_fulfillment (id, order_id, fulfillment_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (order_id, fulfillment_id) DO NOTHING`,
        [ofJoinId, medusaOrderId, fulfillmentId, shipment.created_at, shipment.updated_at]
      )

      // 5. Save ID mapping
      await pgClient.query(
        `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (old_table, old_id) DO NOTHING`,
        ['shipments', shipment.id, 'fulfillment', fulfillmentId]
      )

      inserted++
      if (VERBOSE) {
        console.log(`   ✓ Shipment ${shipment.id} → ${shipment.carrier} (${shipment.status})`)
      }
    } catch (e: any) {
      console.error(`   ✗ Shipment ${shipment.id} failed:`, e.message)
      throw e
    }
  }

  console.log(`\n   ✅ ${inserted} shipments inserted`)
  if (skipped > 0) console.log(`   ⚠️  ${skipped} skipped`)

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\n🔍 Verifying...')
  const fc  = await pgClient.query(`SELECT COUNT(*) FROM fulfillment WHERE deleted_at IS NULL`)
  const flc = await pgClient.query(`SELECT COUNT(*) FROM fulfillment_label WHERE deleted_at IS NULL`)
  const ofc = await pgClient.query(`SELECT COUNT(*) FROM order_fulfillment WHERE deleted_at IS NULL`)
  console.log(`   fulfillments:        ${fc.rows[0].count}`)
  console.log(`   fulfillment_labels:  ${flc.rows[0].count}`)
  console.log(`   order_fulfillments:  ${ofc.rows[0].count}`)
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 11: Migrate Shipments')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    await migrateShipments(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ SHIPMENT MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 12 (verification)')
    console.log('  npm run script:12\n')

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

export { migrateShipments }
