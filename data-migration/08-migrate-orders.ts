/**
 * SCRIPT 08: Migrate Orders
 *
 * Purpose:
 * - Migrate all 864 orders from MySQL → Medusa v2 order tables
 * - Migrate all 1205 order_items → order_line_item + order_item
 * - Create order_address snapshot for each order (from old addresses table)
 * - Create order_summary with totals per order
 * - Preserve all original fields (status, payment info, notes, timestamps) in metadata
 *
 * Source: MySQL `orders` + `order_items`
 *
 * Target tables (Medusa v2):
 * - `order_address`    — shipping address snapshot at time of order
 * - `order`            — the order record (status, customer, currency, etc.)
 * - `order_summary`    — totals snapshot (subtotal, tax, shipping, discount, total)
 * - `order_line_item`  — individual line items with product/variant snapshots
 * - `order_item`       — fulfillment quantity tracking per line item
 *
 * Status mapping (old → Medusa order_status_enum):
 *   pending                  → pending
 *   confirmed / processing   → pending          (in-progress)
 *   shipped / out_for_delivery / delivered → completed
 *   cancellation_requested / cancelled    → canceled
 *   returned / refunded      → canceled
 *   failed                   → requires_action
 *
 * Complexity: ⭐⭐⭐⭐ HIGH (5 tables, FK chains, JSONB raw fields)
 * Duration: ~2-4 minutes
 *
 * Run: npm run script:08
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

interface OldOrder {
  id: number
  order_number: string
  user_id: number
  address_id: number
  status: string
  payment_status: string
  payment_method: string | null
  subtotal: string
  shipping_cost: string
  tax: string
  discount: string
  total: string
  notes: string | null
  tracking_number: string | null
  shipped_at: Date | null
  delivered_at: Date | null
  cancelled_at: Date | null
  cancellation_reason: string | null
  created_at: Date
  updated_at: Date
  idempotency_key: string | null
  is_offline_payment: number
  offline_payment_note: string | null
  offline_payment_ref: string | null
  processed_by_admin_id: number | null
  estimated_delivery_date: Date | null
  shipping_carrier: string | null
  correlation_id: string | null
  stock_deducted_at: Date | null
  stock_deducted_by: string | null
  stock_restored_at: Date | null
  stock_restored_by: string | null
}

interface OldOrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  price: string
  total: string
  created_at: Date
  category_id_at_purchase: number | null
  category_name_at_purchase: string | null
  image_id: number | null
  size: string | null
  cancellation_reason: string | null
  cancelled_at: Date | null
  cancelled_by: string | null
  stock_restored_at: Date | null
  status: string
  image_design_name_snapshot: string | null
  image_sku_snapshot: string | null
  image_url_snapshot: string | null
}

interface OldAddress {
  id: number
  user_id: number
  full_name: string
  phone: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
  country: string
  is_default: number
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

/**
 * Medusa v2 uses raw_* JSONB alongside numeric for precise arithmetic.
 * Format: {"value": "9999", "precision": 20}
 * Amount should be in smallest unit (paise) for display, but Medusa v2
 * actually stores rupees as numeric. We store in rupees (decimal).
 */
function rawAmount(value: string | number): object {
  return { value: String(value), precision: 20 }
}

/**
 * Map old system order status → Medusa order_status_enum
 */
function mapOrderStatus(oldStatus: string): string {
  switch (oldStatus) {
    case 'pending':
    case 'confirmed':
    case 'processing':
      return 'pending'
    case 'shipped':
    case 'out_for_delivery':
    case 'delivered':
      return 'completed'
    case 'cancellation_requested':
    case 'cancelled':
    case 'returned':
    case 'refunded':
      return 'canceled'
    case 'failed':
      return 'requires_action'
    default:
      return 'pending'
  }
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

function normalizeCountryCode(country: string): string {
  const c = (country || '').trim().toLowerCase()
  if (c === 'india' || c === 'in') return 'in'
  return c.substring(0, 2) || 'in'
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

async function migrateOrders(mysqlConnection: any, pgClient: PgClient): Promise<void> {
  console.log('\n📦 Starting order migration...\n')

  // ── Load source data ──────────────────────────────────────────────────────
  console.log('📥 Reading MySQL data...')
  const [orderRows] = await mysqlConnection.query('SELECT * FROM orders ORDER BY id ASC')
  const orders = orderRows as OldOrder[]

  const [itemRows] = await mysqlConnection.query('SELECT * FROM order_items ORDER BY order_id ASC, id ASC')
  const allItems = itemRows as OldOrderItem[]

  const [addrRows] = await mysqlConnection.query('SELECT * FROM addresses')
  const addresses = addrRows as OldAddress[]
  const addressMap = new Map<number, OldAddress>()
  for (const a of addresses) addressMap.set(a.id, a)

  // Build items-per-order map
  const itemsByOrder = new Map<number, OldOrderItem[]>()
  for (const item of allItems) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, [])
    itemsByOrder.get(item.order_id)!.push(item)
  }

  console.log(`   ${orders.length} orders, ${allItems.length} order items, ${addresses.length} addresses`)

  // ── Load customer ID mappings ─────────────────────────────────────────────
  console.log('📥 Loading customer ID mappings...')
  const custRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'users' AND new_table = 'customer'`
  )
  const customerIdMap = new Map<number, string>()
  for (const r of custRes.rows) customerIdMap.set(r.old_id, r.new_id)
  console.log(`   ${customerIdMap.size} customer mappings`)

  // ── Load product/variant ID mappings ────────────────────────────────────
  console.log('📥 Loading product and variant ID mappings...')
  const prodRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'products' AND new_table = 'product'`
  )
  const productIdMap = new Map<number, string>()
  for (const r of prodRes.rows) productIdMap.set(r.old_id, r.new_id)

  const varRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'products_variants' AND new_table = 'product_variant'`
  )
  const variantIdMap = new Map<number, string>()
  for (const r of varRes.rows) variantIdMap.set(r.old_id, r.new_id)

  console.log(`   ${productIdMap.size} product mappings, ${variantIdMap.size} variant mappings`)

  // ── Process each order ───────────────────────────────────────────────────
  console.log('\n💾 Inserting orders...')
  let orderInserted = 0
  let itemInserted = 0
  let orderSkipped = 0

  for (const order of orders) {
    const orderId = generateUUIDFromId('orders', order.id)
    const address = addressMap.get(order.address_id)
    const customerId = customerIdMap.get(order.user_id) || null

    // ── 1. order_address (shipping address snapshot) ──────────────────────
    const addrId = generateUUIDFromId('order_address', order.id)
    if (address) {
      const { firstName, lastName } = splitFullName(address.full_name)
      try {
        await pgClient.query(
          `INSERT INTO order_address (id, customer_id, first_name, last_name, address_1, address_2, city, province, postal_code, country_code, phone, metadata, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (id) DO NOTHING`,
          [
            addrId,
            customerId,
            firstName,
            lastName,
            address.address_line1,
            address.address_line2 || null,
            address.city,
            address.state,
            address.postal_code,
            normalizeCountryCode(address.country),
            address.phone,
            JSON.stringify({ oldAddressId: address.id }),
            order.created_at,
            order.updated_at,
          ]
        )
      } catch (e: any) {
        console.error(`   ✗ order_address failed for order ${order.id}:`, e.message)
        throw e
      }
    }

    // ── 2. order ──────────────────────────────────────────────────────────
    const medusaStatus = mapOrderStatus(order.status)
    const canceledAt = ['canceled', 'cancelled'].includes(medusaStatus) ? (order.cancelled_at || order.updated_at) : null

    const metadata = {
      oldOrderId: order.id,
      oldOrderNumber: order.order_number,
      oldStatus: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      isOfflinePayment: Boolean(order.is_offline_payment),
      offlinePaymentNote: order.offline_payment_note,
      offlinePaymentRef: order.offline_payment_ref,
      notes: order.notes,
      trackingNumber: order.tracking_number,
      shippingCarrier: order.shipping_carrier,
      shippedAt: order.shipped_at,
      deliveredAt: order.delivered_at,
      estimatedDeliveryDate: order.estimated_delivery_date,
      cancellationReason: order.cancellation_reason,
      idempotencyKey: order.idempotency_key,
      correlationId: order.correlation_id,
      stockDeductedAt: order.stock_deducted_at,
      stockDeductedBy: order.stock_deducted_by,
      stockRestoredAt: order.stock_restored_at,
      stockRestoredBy: order.stock_restored_by,
    }

    try {
      await pgClient.query(
        `INSERT INTO "order" (id, customer_id, email, currency_code, status, shipping_address_id, billing_address_id, metadata, canceled_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::order_status_enum,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          orderId,
          customerId,
          null,           // email — we have customer_id; Medusa resolves from customer
          CURRENCY_CODE,
          medusaStatus,
          address ? addrId : null,
          address ? addrId : null,  // billing = shipping (old system had one address)
          JSON.stringify(metadata),
          canceledAt,
          order.created_at,
          order.updated_at,
        ]
      )
    } catch (e: any) {
      console.error(`   ✗ order insert failed for order ${order.id}:`, e.message)
      throw e
    }

    // ── 3. order_summary ─────────────────────────────────────────────────
    const summaryId = generateUUIDFromId('order_summary', order.id)
    const subtotal = parseFloat(order.subtotal)
    const shippingCost = parseFloat(order.shipping_cost)
    const tax = parseFloat(order.tax)
    const discount = parseFloat(order.discount)
    const total = parseFloat(order.total)

    const totals = {
      subtotal,
      shipping_total: shippingCost,
      tax_total: tax,
      discount_total: discount,
      total,
      original_total: subtotal + shippingCost,
      raw_subtotal: rawAmount(subtotal),
      raw_shipping_total: rawAmount(shippingCost),
      raw_tax_total: rawAmount(tax),
      raw_discount_total: rawAmount(discount),
      raw_total: rawAmount(total),
    }

    try {
      await pgClient.query(
        `INSERT INTO order_summary (id, order_id, version, totals, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [summaryId, orderId, 1, JSON.stringify(totals), order.created_at, order.updated_at]
      )
    } catch (e: any) {
      console.error(`   ✗ order_summary failed for order ${order.id}:`, e.message)
      throw e
    }

    // ── 4. order_line_item + order_item per item ──────────────────────────
    const items = itemsByOrder.get(order.id) || []
    for (const item of items) {
      const lineItemId = generateUUIDFromId('order_items', item.id)
      const orderItemId = generateUUIDFromId('order_items_oi', item.id)

      const unitPrice = parseFloat(item.price)
      const qty = item.quantity

      // Determine variant_id and product_id from mappings
      const medusaProductId = productIdMap.get(item.product_id) || null
      // For variant: use product_id mapping — default variant uuid was generated from product_id
      const medusaVariantId = variantIdMap.get(item.product_id) || null

      const itemMetadata = {
        oldItemId: item.id,
        oldOrderId: item.order_id,
        oldProductId: item.product_id,
        oldImageId: item.image_id,
        size: item.size,
        categoryIdAtPurchase: item.category_id_at_purchase,
        categoryNameAtPurchase: item.category_name_at_purchase,
        imageDesignNameSnapshot: item.image_design_name_snapshot,
        imageSkuSnapshot: item.image_sku_snapshot,
        imageUrlSnapshot: item.image_url_snapshot,
        itemStatus: item.status,
        cancellationReason: item.cancellation_reason,
        cancelledAt: item.cancelled_at,
        cancelledBy: item.cancelled_by,
        stockRestoredAt: item.stock_restored_at,
      }

      // Build a CloudFront thumbnail URL from image_url_snapshot
      const thumbnailUrl = item.image_url_snapshot
        ? `https://d1234example.cloudfront.net/${item.image_url_snapshot}`
        : null

      try {
        // order_line_item — product/variant snapshot at time of purchase (no quantity col here)
        await pgClient.query(
          `INSERT INTO order_line_item (
            id, title, subtitle, thumbnail,
            variant_id, product_id,
            product_title, variant_sku, variant_title,
            unit_price, raw_unit_price,
            requires_shipping, is_discountable, is_tax_inclusive, is_custom_price, is_giftcard,
            metadata, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (id) DO NOTHING`,
          [
            lineItemId,
            item.image_design_name_snapshot || `Product #${item.product_id}`,  // title
            item.size ? `Size: ${item.size}` : null,                            // subtitle
            thumbnailUrl,
            medusaVariantId,
            medusaProductId,
            item.image_design_name_snapshot || null,  // product_title snapshot
            item.image_sku_snapshot || null,           // variant_sku snapshot
            item.size || 'Default',                    // variant_title
            unitPrice,
            JSON.stringify(rawAmount(unitPrice)),
            true,   // requires_shipping
            true,   // is_discountable
            false,  // is_tax_inclusive
            false,  // is_custom_price
            false,  // is_giftcard
            JSON.stringify(itemMetadata),
            item.created_at,
            item.created_at,
          ]
        )
      } catch (e: any) {
        console.error(`   ✗ order_line_item failed for item ${item.id}:`, e.message)
        throw e
      }

      // order_item — fulfillment quantity tracking
      const isCancelled = item.status === 'cancelled'
      const isDelivered = ['delivered', 'completed'].includes(order.status)
      const isShipped = ['shipped', 'out_for_delivery', 'delivered'].includes(order.status)

      const fulfilledQty = isCancelled ? 0 : qty
      const shippedQty = isShipped && !isCancelled ? qty : 0
      const deliveredQty = isDelivered && !isCancelled ? qty : 0

      try {
        await pgClient.query(
          `INSERT INTO order_item (
            id, order_id, version, item_id,
            quantity, raw_quantity,
            fulfilled_quantity, raw_fulfilled_quantity,
            shipped_quantity, raw_shipped_quantity,
            delivered_quantity, raw_delivered_quantity,
            return_requested_quantity, raw_return_requested_quantity,
            return_received_quantity, raw_return_received_quantity,
            return_dismissed_quantity, raw_return_dismissed_quantity,
            written_off_quantity, raw_written_off_quantity,
            metadata, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
          ON CONFLICT (id) DO NOTHING`,
          [
            orderItemId,
            orderId,
            1,
            lineItemId,
            qty,  JSON.stringify(rawAmount(qty)),
            fulfilledQty, JSON.stringify(rawAmount(fulfilledQty)),
            shippedQty,   JSON.stringify(rawAmount(shippedQty)),
            deliveredQty, JSON.stringify(rawAmount(deliveredQty)),
            0, JSON.stringify(rawAmount(0)),
            0, JSON.stringify(rawAmount(0)),
            0, JSON.stringify(rawAmount(0)),
            0, JSON.stringify(rawAmount(0)),
            JSON.stringify({ oldItemId: item.id }),
            item.created_at,
            item.created_at,
          ]
        )
      } catch (e: any) {
        console.error(`   ✗ order_item failed for item ${item.id}:`, e.message)
        throw e
      }

      itemInserted++
    }

    // ── 5. Save order ID mapping ──────────────────────────────────────────
    try {
      await pgClient.query(
        `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (old_table, old_id) DO NOTHING`,
        ['orders', order.id, 'order', orderId]
      )
    } catch (e: any) {
      console.error(`   ✗ id mapping failed for order ${order.id}:`, e.message)
      throw e
    }

    orderInserted++
    if (VERBOSE && orderInserted % 100 === 0) {
      console.log(`   ... ${orderInserted} orders processed`)
    }
  }

  console.log(`\n   ✅ ${orderInserted} orders inserted (${orderSkipped} skipped)`)
  console.log(`   ✅ ${itemInserted} order line items inserted`)

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\n🔍 Verifying...')
  const oc = await pgClient.query(`SELECT COUNT(*) FROM "order" WHERE deleted_at IS NULL`)
  const lic = await pgClient.query(`SELECT COUNT(*) FROM order_line_item WHERE deleted_at IS NULL`)
  const oic = await pgClient.query(`SELECT COUNT(*) FROM order_item WHERE deleted_at IS NULL`)
  const osc = await pgClient.query(`SELECT COUNT(*) FROM order_summary WHERE deleted_at IS NULL`)
  const oac = await pgClient.query(`SELECT COUNT(*) FROM order_address WHERE deleted_at IS NULL`)
  const mc = await pgClient.query(`SELECT COUNT(*) FROM migration_id_map WHERE old_table = 'orders'`)

  console.log(`   orders:           ${oc.rows[0].count}`)
  console.log(`   order_line_items: ${lic.rows[0].count}`)
  console.log(`   order_items:      ${oic.rows[0].count}`)
  console.log(`   order_summaries:  ${osc.rows[0].count}`)
  console.log(`   order_addresses:  ${oac.rows[0].count}`)
  console.log(`   ID mappings:      ${mc.rows[0].count}`)

  // Status breakdown
  const statusBreakdown = await pgClient.query(
    `SELECT status, COUNT(*) as c FROM "order" WHERE deleted_at IS NULL GROUP BY status ORDER BY c DESC`
  )
  console.log('\n   Status breakdown:')
  for (const row of statusBreakdown.rows) {
    console.log(`     ${row.status.padEnd(20)} ${row.c}`)
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 08: Migrate Orders')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    await migrateOrders(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ ORDER MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 09 (migrate payments)')
    console.log('  npm run script:09\n')

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

export { migrateOrders }
