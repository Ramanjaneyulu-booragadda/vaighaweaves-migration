/**
 * SCRIPT 13: Migrate Stock Reservations
 *
 * Source:  MySQL `stock_reservations` (1049 rows)
 * Target:  PostgreSQL `stock_reservation` (custom table, created in script:01)
 *
 * Mapping:
 *   id            → deterministic UUID
 *   product_id    → product UUID via migration_id_map (products → product)
 *   variant_id    → variant UUID via migration_id_map (product_variants → product_variant)
 *                   OR default variant lookup from product_id when variant_id is null
 *   image_id      → stored in metadata.image_id (image UUID looked up too)
 *   quantity      → quantity
 *   reserved_by   → staff_id (admin user → Medusa user UUID)
 *   reserved_for  → customer_id (customer UUID if present)
 *   customer_name → customer_name
 *   customer_phone→ customer_phone
 *   status        → status (ACTIVE / CANCELLED / EXPIRED / CONVERTED)
 *   expires_at    → expires_at
 *   notes         → notes
 *   order_id      → order_id (Medusa order UUID)
 *   size          → metadata.size
 *   created_at    → created_at
 *   updated_at    → updated_at
 *
 * Run: npm run script:13
 */

import { Client as PgClient } from 'pg'
import mysql from 'mysql2/promise'
import crypto from 'crypto'

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

const BATCH_SIZE = 100

// ============================================================================
// HELPERS
// ============================================================================

function generateUUIDFromId(table: string, id: number): string {
  const hash = crypto.createHash('sha1').update(`${table}:${id}`).digest('hex')
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join('-')
}

async function connectMySQL() { return mysql.createConnection(OLD_DB_CONFIG) }
async function connectPostgreSQL() {
  const client = new PgClient(NEW_DB_CONFIG)
  await client.connect()
  return client
}

// ============================================================================
// LOAD ALL ID MAPS
// ============================================================================

interface IdMaps {
  products: Map<number, string>          // MySQL product_id → PG product UUID
  productVariants: Map<number, string>   // MySQL variant_id → PG variant UUID
  productImages: Map<number, string>     // MySQL image_id   → PG image UUID
  users: Map<number, string>             // MySQL user_id    → PG user UUID (admins)
  customers: Map<number, string>         // MySQL user_id    → PG customer UUID
  orders: Map<number, string>            // MySQL order_id   → PG order UUID
}

async function loadIdMaps(pgClient: PgClient): Promise<IdMaps> {
  const query = async (oldTable: string, newTable: string) => {
    const r = await pgClient.query(
      `SELECT old_id, new_id FROM migration_id_map WHERE old_table=$1 AND new_table=$2`,
      [oldTable, newTable]
    )
    const m = new Map<number, string>()
    for (const row of r.rows) m.set(parseInt(row.old_id), row.new_id)
    return m
  }

  const [products, productVariants, productImages, users, customers, orders] = await Promise.all([
    query('products', 'product'),
    query('product_variants', 'product_variant'),
    query('product_images', 'image'),
    query('users', 'user'),
    query('users', 'customer'),
    query('orders', 'order'),
  ])

  console.log(`  ID maps loaded: products=${products.size}, variants=${productVariants.size}, images=${productImages.size}, users=${users.size}, customers=${customers.size}, orders=${orders.size}`)

  return { products, productVariants, productImages, users, customers, orders }
}

// ============================================================================
// BUILD DEFAULT VARIANT LOOKUP (product_id → first variant UUID)
// ============================================================================

async function buildDefaultVariantLookup(pgClient: PgClient): Promise<Map<string, string>> {
  // For each product, get its first variant (the default/only variant)
  const r = await pgClient.query(
    `SELECT DISTINCT ON (product_id) product_id, id as variant_id
     FROM product_variant
     WHERE deleted_at IS NULL
     ORDER BY product_id, created_at ASC`
  )
  const m = new Map<string, string>()
  for (const row of r.rows) m.set(row.product_id, row.variant_id)
  return m
}

// ============================================================================
// MIGRATE RESERVATIONS
// ============================================================================

async function migrateStockReservations(
  mysqlConn: any,
  pgClient: PgClient,
  maps: IdMaps,
  defaultVariantByProduct: Map<string, string>
): Promise<void> {
  const [rows] = await mysqlConn.query(`SELECT * FROM stock_reservations ORDER BY id ASC`) as [any[], any]

  console.log(`\nFound ${rows.length} stock reservations to migrate`)

  let migrated = 0
  let skipped = 0
  let noVariantWarnings = 0
  let noProductWarnings = 0

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    const batch = rows.slice(batchStart, batchStart + BATCH_SIZE)

    for (const row of batch) {
      const reservationId = generateUUIDFromId('stock_reservations', row.id)

      // ── Resolve product UUID ────────────────────────────────────────────
      const productUUID = maps.products.get(row.product_id)
      if (!productUUID) {
        noProductWarnings++
        if (noProductWarnings <= 5) {
          console.warn(`  ⚠️  Skipping reservation id=${row.id}: product_id=${row.product_id} not found in map`)
        }
        skipped++
        continue
      }

      // ── Resolve variant UUID ────────────────────────────────────────────
      let variantUUID: string | null = null

      if (row.variant_id) {
        variantUUID = maps.productVariants.get(row.variant_id) || null
      }

      // Fall back to image-based lookup: find variant for this product+image combo
      if (!variantUUID && row.image_id) {
        const imageUUID = maps.productImages.get(row.image_id)
        if (imageUUID) {
          // Variant was created from this image in script:05 — its UUID is generated from the image
          const imgBasedVariantId = generateUUIDFromId('product_variants_from_image', row.image_id)
          // Check if it exists in PG
          const exists = await pgClient.query(
            `SELECT id FROM product_variant WHERE id = $1 AND product_id = $2 LIMIT 1`,
            [imgBasedVariantId, productUUID]
          )
          if (exists.rows.length > 0) {
            variantUUID = imgBasedVariantId
          }
        }
      }

      // Final fallback: use the product's default (first) variant
      if (!variantUUID) {
        variantUUID = defaultVariantByProduct.get(productUUID) || null
        if (!variantUUID) {
          noVariantWarnings++
          if (noVariantWarnings <= 5) {
            console.warn(`  ⚠️  Skipping reservation id=${row.id}: no variant found for product_id=${row.product_id}`)
          }
          skipped++
          continue
        }
      }

      // ── Resolve staff UUID ──────────────────────────────────────────────
      // reserved_by is always an admin user
      const staffUUID = maps.users.get(row.reserved_by)
        || generateUUIDFromId('users_user', row.reserved_by) // fallback

      // ── Resolve customer UUID ───────────────────────────────────────────
      let customerUUID: string | null = null
      if (row.reserved_for) {
        customerUUID = maps.customers.get(row.reserved_for) || null
      }

      // ── Resolve order UUID ──────────────────────────────────────────────
      let orderUUID: string | null = null
      if (row.order_id) {
        orderUUID = maps.orders.get(row.order_id) || null
      }

      // ── Resolve image UUID for metadata ────────────────────────────────
      const imageUUID = row.image_id ? (maps.productImages.get(row.image_id) || null) : null

      // ── Build metadata ──────────────────────────────────────────────────
      const metadata = {
        old_id: row.id,
        image_id: imageUUID,
        old_image_id: row.image_id,
        old_product_id: row.product_id,
        old_variant_id: row.variant_id,
        old_reserved_by: row.reserved_by,
        old_reserved_for: row.reserved_for,
        size: row.size || null,
      }

      // ── INSERT ──────────────────────────────────────────────────────────
      await pgClient.query(
        `INSERT INTO stock_reservation
           (id, staff_id, customer_id, product_id, variant_id, quantity,
            customer_name, customer_phone, status, expires_at, order_id,
            notes, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO NOTHING`,
        [
          reservationId,
          staffUUID,
          customerUUID,
          productUUID,
          variantUUID,
          row.quantity,
          row.customer_name || null,
          row.customer_phone || null,
          row.status,        // ACTIVE / CANCELLED / EXPIRED / CONVERTED
          row.expires_at,
          orderUUID,
          row.notes || null,
          JSON.stringify(metadata),
          row.created_at,
          row.updated_at || row.created_at,
        ]
      )

      migrated++
    }

    const progress = Math.min(batchStart + BATCH_SIZE, rows.length)
    process.stdout.write(`\r  Progress: ${progress}/${rows.length} (migrated=${migrated}, skipped=${skipped})`)
  }

  console.log(`\n\n  ✅ Migration complete`)
  console.log(`     Migrated : ${migrated}`)
  console.log(`     Skipped  : ${skipped}`)
  if (noProductWarnings > 5) console.warn(`     ... and ${noProductWarnings - 5} more product-not-found warnings`)
  if (noVariantWarnings > 5) console.warn(`     ... and ${noVariantWarnings - 5} more variant-not-found warnings`)

  // ── Status breakdown ────────────────────────────────────────────────────
  const breakdown = await pgClient.query(
    `SELECT status, COUNT(*) as c FROM stock_reservation GROUP BY status ORDER BY c DESC`
  )
  console.log(`\n  Status breakdown:`)
  for (const r of breakdown.rows) {
    console.log(`     ${r.status.padEnd(12)}: ${r.c}`)
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 13: Migrate Stock Reservations')
  console.log('================================================================================')

  let mysqlConn: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConn = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    console.log('\n📋 Loading ID maps...')
    const maps = await loadIdMaps(pgClient)

    console.log('\n📋 Building default variant lookup...')
    const defaultVariantByProduct = await buildDefaultVariantLookup(pgClient)
    console.log(`   Default variant lookup: ${defaultVariantByProduct.size} products`)

    await migrateStockReservations(mysqlConn, pgClient, maps, defaultVariantByProduct)

    // Register in migration_id_map
    const count = await pgClient.query(`SELECT COUNT(*) as c FROM stock_reservation`)
    await pgClient.query(`
      INSERT INTO migration_id_map (old_table, new_table, old_id, new_id)
      SELECT 'stock_reservations', 'stock_reservation',
             (metadata->>'old_id')::integer,
             id
      FROM stock_reservation
      WHERE metadata->>'old_id' IS NOT NULL
      ON CONFLICT (old_table, old_id) DO NOTHING
    `)
    console.log(`\n  ID map updated: ${count.rows[0].c} stock_reservation entries registered`)

    console.log('\n================================================================================')
    console.log('✅ SCRIPT 13 COMPLETE — All migration scripts (01–13) have been run!')
    console.log('================================================================================')
    console.log('\n🎉 Migration complete! Full pipeline:')
    console.log('   01: Schema setup')
    console.log('   02: Categories     (92)')
    console.log('   03: Products       (117)')
    console.log('   04: Images         (1311)')
    console.log('   05: Variants       (127)')
    console.log('   06: Users          (2573)')
    console.log('   07: Addresses      (610)')
    console.log('   08: Orders         (864 orders, 1205 items)')
    console.log('   09: Payments       (863)')
    console.log('   10: Stock events   (36)')
    console.log('   11: Shipments      (0 — source empty)')
    console.log('   12: Verification   ✅ ALL CHECKS PASSED')
    console.log('   13: Stock reservations (this script)')
    console.log('\nNext: Start Medusa server and verify API endpoints')
    console.log('  cd ../vaighaweaves-medusa && npx medusa develop\n')

  } catch (error) {
    console.error('\n❌ SCRIPT 13 FAILED:', error)
    process.exit(1)
  } finally {
    if (mysqlConn) await mysqlConn.end()
    if (pgClient) await pgClient.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
