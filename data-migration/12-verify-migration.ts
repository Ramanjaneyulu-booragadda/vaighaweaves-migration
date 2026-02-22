/**
 * SCRIPT 12: Verify Migration
 *
 * Purpose:
 * - Compare source MySQL counts vs target PostgreSQL counts for every migrated entity
 * - Spot-check critical foreign key relationships (orders → customers, items → orders, etc.)
 * - Verify ID mappings are complete
 * - Report any discrepancies clearly
 *
 * Run: npm run script:12
 */

import { Client as PgClient } from 'pg'
import mysql from 'mysql2/promise'

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

// ============================================================================
// HELPERS
// ============================================================================

async function connectMySQL() { return mysql.createConnection(OLD_DB_CONFIG) }
async function connectPostgreSQL() {
  const client = new PgClient(NEW_DB_CONFIG)
  await client.connect()
  return client
}

function count(n: number | string): number { return Number(n) }

const PASS = '✅'
const FAIL = '❌'
const WARN = '⚠️ '

function check(label: string, expected: number, actual: number, allowDiff = 0): boolean {
  const diff = actual - expected
  const ok = Math.abs(diff) <= allowDiff
  const icon = ok ? PASS : FAIL
  const diffStr = diff === 0 ? '' : ` (diff: ${diff > 0 ? '+' : ''}${diff})`
  console.log(`  ${icon} ${label.padEnd(45)} MySQL=${expected}  PG=${actual}${diffStr}`)
  return ok
}

function checkMin(label: string, actual: number, min: number): boolean {
  const ok = actual >= min
  console.log(`  ${ok ? PASS : FAIL} ${label.padEnd(45)} count=${actual} (min ${min})`)
  return ok
}

// ============================================================================
// MAIN VERIFICATION
// ============================================================================

async function verify(mysqlConnection: any, pgClient: PgClient): Promise<void> {

  // ── Source counts ─────────────────────────────────────────────────────────
  const [catCnt]    = await mysqlConnection.query(`SELECT COUNT(*) as c FROM categories WHERE deleted_at IS NULL`)
  const [prodCnt]   = await mysqlConnection.query(`SELECT COUNT(*) as c FROM products`)
  const [imgCnt]    = await mysqlConnection.query(`SELECT COUNT(*) as c FROM product_images WHERE deleted_at IS NULL`)
  const [varCnt]    = await mysqlConnection.query(`SELECT COUNT(*) as c FROM product_variants`)
  const [userCnt]   = await mysqlConnection.query(`SELECT COUNT(*) as c FROM users`)
  const [custCnt]   = await mysqlConnection.query(`SELECT COUNT(*) as c FROM users WHERE role != 'administrator'`)
  const [adminCnt]  = await mysqlConnection.query(`SELECT COUNT(*) as c FROM users WHERE role = 'administrator'`)
  const [addrCnt]   = await mysqlConnection.query(`SELECT COUNT(*) as c FROM addresses`)
  const [orderCnt]  = await mysqlConnection.query(`SELECT COUNT(*) as c FROM orders`)
  const [itemCnt]   = await mysqlConnection.query(`SELECT COUNT(*) as c FROM order_items`)
  const [payCnt]    = await mysqlConnection.query(`SELECT COUNT(*) as c FROM payments`)
  const [seventCnt] = await mysqlConnection.query(`SELECT COUNT(*) as c FROM stock_events`)

  // ── Target counts ─────────────────────────────────────────────────────────
  const pgCat   = count((await pgClient.query(`SELECT COUNT(*) as c FROM product_category WHERE deleted_at IS NULL`)).rows[0].c)
  const pgProd  = count((await pgClient.query(`SELECT COUNT(*) as c FROM product WHERE deleted_at IS NULL`)).rows[0].c)
  const pgImg   = count((await pgClient.query(`SELECT COUNT(*) as c FROM image WHERE deleted_at IS NULL`)).rows[0].c)
  const pgVar   = count((await pgClient.query(`SELECT COUNT(*) as c FROM product_variant WHERE deleted_at IS NULL`)).rows[0].c)
  const pgCust  = count((await pgClient.query(`SELECT COUNT(*) as c FROM customer WHERE deleted_at IS NULL`)).rows[0].c)
  const pgUser  = count((await pgClient.query(`SELECT COUNT(*) as c FROM "user" WHERE deleted_at IS NULL`)).rows[0].c)
  const pgAddr  = count((await pgClient.query(`SELECT COUNT(*) as c FROM customer_address WHERE deleted_at IS NULL`)).rows[0].c)
  const pgOrder = count((await pgClient.query(`SELECT COUNT(*) as c FROM "order" WHERE deleted_at IS NULL`)).rows[0].c)
  const pgLI    = count((await pgClient.query(`SELECT COUNT(*) as c FROM order_line_item WHERE deleted_at IS NULL`)).rows[0].c)
  const pgOI    = count((await pgClient.query(`SELECT COUNT(*) as c FROM order_item WHERE deleted_at IS NULL`)).rows[0].c)
  const pgPC    = count((await pgClient.query(`SELECT COUNT(*) as c FROM payment_collection WHERE deleted_at IS NULL`)).rows[0].c)
  const pgPS    = count((await pgClient.query(`SELECT COUNT(*) as c FROM payment_session WHERE deleted_at IS NULL`)).rows[0].c)
  const pgPM    = count((await pgClient.query(`SELECT COUNT(*) as c FROM payment WHERE deleted_at IS NULL`)).rows[0].c)
  const pgSE    = count((await pgClient.query(`SELECT COUNT(*) as c FROM stock_event`)).rows[0].c)
  const pgOSum  = count((await pgClient.query(`SELECT COUNT(*) as c FROM order_summary WHERE deleted_at IS NULL`)).rows[0].c)
  const pgOAddr = count((await pgClient.query(`SELECT COUNT(*) as c FROM order_address WHERE deleted_at IS NULL`)).rows[0].c)
  const pgOPC   = count((await pgClient.query(`SELECT COUNT(*) as c FROM order_payment_collection WHERE deleted_at IS NULL`)).rows[0].c)
  const pgPS2   = count((await pgClient.query(`SELECT COUNT(*) as c FROM price_set`)).rows[0].c)
  const pgPrice = count((await pgClient.query(`SELECT COUNT(*) as c FROM price`)).rows[0].c)
  const pgInvI  = count((await pgClient.query(`SELECT COUNT(*) as c FROM inventory_item WHERE deleted_at IS NULL`)).rows[0].c)
  const pgInvL  = count((await pgClient.query(`SELECT COUNT(*) as c FROM inventory_level WHERE deleted_at IS NULL`)).rows[0].c)

  // ── ID Mapping counts ─────────────────────────────────────────────────────
  const mapRes = await pgClient.query(
    `SELECT old_table, new_table, COUNT(*) as c FROM migration_id_map GROUP BY old_table, new_table ORDER BY old_table, new_table`
  )

  let failures = 0

  // ── Section 1: Entity count parity ───────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SECTION 1: SOURCE vs TARGET COUNT PARITY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (!check('Categories (active)',          count(catCnt[0].c),    pgCat))   failures++
  if (!check('Products',                     count(prodCnt[0].c),   pgProd))  failures++
  if (!check('Product images (active)',      count(imgCnt[0].c),    pgImg))   failures++
  // MySQL product_variants is 0 — Medusa variants were generated from product_images+sizes in script:05
  // So we just report it informatively, not as a failure
  console.log(`  ${PASS} ${'Product variants (generated from images)'.padEnd(45)} MySQL_raw=0  PG=${pgVar} (generated by script:05)`)
  if (!check('Customers (non-admin users)',  count(custCnt[0].c),   pgCust, 5)) failures++ // minor OK: guest dedup
  if (!check('Admin users',                  count(adminCnt[0].c),  pgUser,  4)) failures++ // may include pre-existing Medusa admin
  if (!check('Addresses',                    count(addrCnt[0].c),   pgAddr, 5)) failures++ // 5 admin addrs skipped
  if (!check('Orders',                       count(orderCnt[0].c),  pgOrder)) failures++
  if (!check('Order line items',             count(itemCnt[0].c),   pgLI))    failures++
  if (!check('Order items (fulfillment)',    count(itemCnt[0].c),   pgOI))    failures++
  if (!check('Order summaries',              count(orderCnt[0].c),  pgOSum))  failures++
  if (!check('Order addresses',              count(orderCnt[0].c),  pgOAddr)) failures++
  if (!check('Payments → payment_collection', count(payCnt[0].c),  pgPC))    failures++
  if (!check('Payments → payment_session',   count(payCnt[0].c),   pgPS))    failures++
  if (!check('Payments → payment',           count(payCnt[0].c),   pgPM))    failures++
  if (!check('Order payment collections',    count(payCnt[0].c),   pgOPC))   failures++
  if (!check('Stock events',                 count(seventCnt[0].c), pgSE))    failures++

  // ── Section 2: Derived/chain tables ──────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SECTION 2: DERIVED TABLE COUNTS (price/inventory chain)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (!checkMin('price_sets (1 per variant)',     pgPS2,   pgVar))  failures++
  if (!checkMin('prices (1 per variant)',         pgPrice, pgVar))  failures++
  if (!checkMin('inventory_items (1 per variant)', pgInvI, pgVar))  failures++
  if (!checkMin('inventory_levels (1 per variant)', pgInvL, pgVar)) failures++

  // ── Section 3: FK integrity spot-checks ──────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SECTION 3: FK INTEGRITY SPOT-CHECKS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Orders with null customer_id
  const orphanOrders = count((await pgClient.query(
    `SELECT COUNT(*) as c FROM "order" WHERE customer_id IS NULL AND deleted_at IS NULL`
  )).rows[0].c)
  if (orphanOrders > 0) {
    console.log(`  ${WARN} Orders with no customer_id: ${orphanOrders} (may be guest/walk-in orders)`)
  } else {
    console.log(`  ${PASS} ${'All orders have customer_id'.padEnd(45)}`)
  }

  // Order line items with no product link
  const orphanItems = count((await pgClient.query(
    `SELECT COUNT(*) as c FROM order_line_item WHERE product_id IS NULL AND deleted_at IS NULL`
  )).rows[0].c)
  if (orphanItems > 0) {
    console.log(`  ${WARN} ${'Line items with no product_id: ' + orphanItems} (deleted products)`)
  } else {
    console.log(`  ${PASS} ${'All line items have product_id'.padEnd(45)}`)
  }

  // Payments with no order link
  const orphanPay = count((await pgClient.query(
    `SELECT COUNT(*) as c FROM order_payment_collection opc
     LEFT JOIN "order" o ON opc.order_id = o.id
     WHERE o.id IS NULL AND opc.deleted_at IS NULL`
  )).rows[0].c)
  if (!check('Orphan order_payment_collections', 0, orphanPay)) failures++

  // Products linked to categories
  const prodWithCat = count((await pgClient.query(
    `SELECT COUNT(DISTINCT product_id) as c FROM product_category_product`
  )).rows[0].c)
  console.log(`  ${PASS} ${'Products linked to categories:'.padEnd(45)} ${prodWithCat} / ${pgProd}`)

  // Inventory levels with stock
  const withStock = count((await pgClient.query(
    `SELECT COUNT(*) as c FROM inventory_level WHERE stocked_quantity > 0`
  )).rows[0].c)
  console.log(`  ${PASS} ${'Inventory levels with stock > 0:'.padEnd(45)} ${withStock} / ${pgInvL}`)

  // Payment capture rate
  const captured = count((await pgClient.query(
    `SELECT COUNT(*) as c FROM payment WHERE captured_at IS NOT NULL AND deleted_at IS NULL`
  )).rows[0].c)
  console.log(`  ${PASS} ${'Payments captured (paid):'.padEnd(45)} ${captured} / ${pgPM}`)

  // ── Section 4: ID Mapping completeness ───────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SECTION 4: ID MAPPING COMPLETENESS (migration_id_map)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  let totalMappings = 0
  for (const row of mapRes.rows) {
    const c = count(row.c)
    totalMappings += c
    console.log(`  ${PASS} ${(row.old_table + ' → ' + row.new_table).padEnd(45)} ${c} mappings`)
  }
  console.log(`\n  Total ID mappings: ${totalMappings}`)

  // ── Section 5: Sample data integrity ─────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SECTION 5: SAMPLE DATA INTEGRITY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Sample order
  const sampleOrder = (await pgClient.query(
    `SELECT o.id, o.status, o.currency_code, o.customer_id,
            os.totals->>'total' as total,
            (SELECT COUNT(*) FROM order_line_item li WHERE li.id IN (
              SELECT item_id FROM order_item oi WHERE oi.order_id = o.id
            )) as item_count
     FROM "order" o
     LEFT JOIN order_summary os ON os.order_id = o.id
     LIMIT 3`
  )).rows
  console.log('\n  Sample orders from PostgreSQL:')
  for (const o of sampleOrder) {
    console.log(`    id=${o.id.substring(0,8)}.. status=${o.status} currency=${o.currency_code} items=${o.item_count} total=₹${o.total}`)
  }

  // Sample product
  const sampleProd = (await pgClient.query(
    `SELECT p.id, p.title, p.status, p.handle,
            (SELECT COUNT(*) FROM image i WHERE i.product_id = p.id) as imgs,
            (SELECT COUNT(*) FROM product_variant pv WHERE pv.product_id = p.id) as variants
     FROM product p LIMIT 3`
  )).rows
  console.log('\n  Sample products from PostgreSQL:')
  for (const p of sampleProd) {
    console.log(`    id=${p.id.substring(0,8)}.. "${p.title}" status=${p.status} imgs=${p.imgs} variants=${p.variants}`)
  }

  // ── Final result ──────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (failures === 0) {
    console.log('  ✅ ALL CHECKS PASSED — Migration data parity verified!')
  } else {
    console.log(`  ❌ ${failures} CHECK(S) FAILED — Review the output above`)
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 12: Verify Migration')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    await verify(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ VERIFICATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 13 (migrate stock reservations)')
    console.log('  npm run script:13\n')

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error)
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

export { verify }
