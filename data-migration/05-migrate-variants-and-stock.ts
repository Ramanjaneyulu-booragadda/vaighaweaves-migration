/**
 * SCRIPT 05: Migrate Variants & Stock
 *
 * Purpose:
 * - Create one default variant per product (116 products have no size stocks)
 * - Create sized variants for product 86 (Readymade) from product_image_size_stocks
 * - Create full Medusa v2 inventory chain: variant → inventory_item → inventory_level
 * - Create full Medusa v2 pricing chain: variant → price_set → price (INR)
 * - Create product_option "Size" + option_values for sized products
 *
 * Medusa v2 variant/inventory chain (per variant):
 *   product_variant
 *     → product_variant_price_set → price_set → price (amount in INR)
 *     → product_variant_inventory_item → inventory_item → inventory_level (stocked_quantity)
 *     → product_variant_option → product_option_value → product_option
 *
 * Complexity: ⭐⭐⭐ HARD (7 tables, pricing + inventory chains)
 * Duration: ~30-60 seconds
 *
 * Prerequisites: Scripts 01, 02, 03 must have run successfully
 * Note: stock_location must be created (this script creates one if missing)
 *
 * Run: npm run script:05
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

const STOCK_LOCATION_NAME = 'VaighaWeaves Store'
const CURRENCY_CODE = 'inr'

// ============================================================================
// TYPES (MySQL columns are snake_case)
// ============================================================================

interface OldProduct {
  id: number
  name: string
  sku: string
  price: string // decimal from mysql2
  compare_price: string | null
  cost_price: string | null
  stock_quantity: number
  is_active: number
  created_at: Date
  updated_at: Date
}

interface OldSizeStock {
  id: number
  image_id: number
  size: string
  stock_quantity: number
  created_at: Date
  updated_at: Date
  // Joined fields from product_images
  product_id: number
  design_name: string | null
  image_sku: string | null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateUUIDFromId(tableName: string, oldId: number): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const text = `${tableName}:${oldId}`
  const hash = crypto
    .createHash('sha1')
    .update(namespace + text)
    .digest()
  const hex = hash.toString('hex')
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    '5' + hex.substring(13, 16),
    ((0x8 | (parseInt(hex[16], 16) & 0x3)).toString(16)) + hex.substring(17, 20),
    hex.substring(20, 32),
  ].join('-')
}

/** Generate a deterministic ID from a string key (for non-integer source IDs) */
function generateIdFromKey(key: string): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const hash = crypto
    .createHash('sha1')
    .update(namespace + key)
    .digest()
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
  const connection = await mysql.createConnection(OLD_DB_CONFIG)
  return connection
}

async function connectPostgreSQL() {
  const client = new PgClient(NEW_DB_CONFIG)
  await client.connect()
  return client
}

// ============================================================================
// ENSURE STOCK LOCATION EXISTS
// ============================================================================

async function ensureStockLocation(pgClient: PgClient): Promise<string> {
  // Check if our stock location exists
  const existing = await pgClient.query(
    `SELECT id FROM stock_location WHERE name = $1 AND deleted_at IS NULL LIMIT 1`,
    [STOCK_LOCATION_NAME]
  )

  if (existing.rows.length > 0) {
    console.log(`   ✅ Stock location exists: ${STOCK_LOCATION_NAME} (${existing.rows[0].id})`)
    return existing.rows[0].id
  }

  // Create one
  const locationId = generateIdFromKey('stock_location:vaighaweaves-store')
  await pgClient.query(
    `INSERT INTO stock_location (id, name, metadata)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [locationId, STOCK_LOCATION_NAME, JSON.stringify({ source: 'migration' })]
  )
  console.log(`   ✅ Created stock location: ${STOCK_LOCATION_NAME} (${locationId})`)
  return locationId
}

// ============================================================================
// CREATE VARIANT WITH FULL CHAIN
// ============================================================================

async function createVariantChain(
  pgClient: PgClient,
  opts: {
    variantId: string
    productId: string
    title: string
    sku: string | null
    price: number
    stockQuantity: number
    stockLocationId: string
    variantRank: number
    metadata: Record<string, any>
  }
): Promise<void> {
  const { variantId, productId, title, sku, price, stockQuantity, stockLocationId, variantRank, metadata } = opts

  // 1. Insert product_variant
  await pgClient.query(
    `INSERT INTO product_variant (
      id, title, sku, product_id, variant_rank, manage_inventory, allow_backorder, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING`,
    [variantId, title, sku, productId, variantRank, true, false, JSON.stringify(metadata)]
  )

  // 2. Create price_set
  const priceSetId = generateIdFromKey(`price_set:${variantId}`)
  await pgClient.query(
    `INSERT INTO price_set (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [priceSetId]
  )

  // 3. Link variant → price_set
  const vpLinkId = generateIdFromKey(`vp_link:${variantId}`)
  await pgClient.query(
    `INSERT INTO product_variant_price_set (id, variant_id, price_set_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (variant_id, price_set_id) DO NOTHING`,
    [vpLinkId, variantId, priceSetId]
  )

  // 4. Create price record (INR)
  const priceId = generateIdFromKey(`price:${variantId}:${CURRENCY_CODE}`)
  const rawAmount = JSON.stringify({ value: String(price), precision: 20 })
  await pgClient.query(
    `INSERT INTO price (id, price_set_id, currency_code, amount, raw_amount)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [priceId, priceSetId, CURRENCY_CODE, price, rawAmount]
  )

  // 5. Create inventory_item
  const inventoryItemId = generateIdFromKey(`inv_item:${variantId}`)
  await pgClient.query(
    `INSERT INTO inventory_item (id, sku, title, requires_shipping)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [inventoryItemId, sku, title, true]
  )

  // 6. Link variant → inventory_item
  const viLinkId = generateIdFromKey(`vi_link:${variantId}`)
  await pgClient.query(
    `INSERT INTO product_variant_inventory_item (id, variant_id, inventory_item_id, required_quantity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (variant_id, inventory_item_id) DO NOTHING`,
    [viLinkId, variantId, inventoryItemId, 1]
  )

  // 7. Create inventory_level (stock at location)
  const inventoryLevelId = generateIdFromKey(`inv_level:${variantId}:${stockLocationId}`)
  const rawStocked = JSON.stringify({ value: String(stockQuantity), precision: 20 })
  const rawZero = JSON.stringify({ value: '0', precision: 20 })
  await pgClient.query(
    `INSERT INTO inventory_level (
      id, inventory_item_id, location_id, stocked_quantity, reserved_quantity, incoming_quantity,
      raw_stocked_quantity, raw_reserved_quantity, raw_incoming_quantity
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO NOTHING`,
    [inventoryLevelId, inventoryItemId, stockLocationId, stockQuantity, 0, 0, rawStocked, rawZero, rawZero]
  )
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrateVariantsAndStock(
  mysqlConnection: any,
  pgClient: PgClient
): Promise<void> {
  console.log('\n📦 Starting variant & stock migration...\n')

  try {
    // Step 1: Ensure stock location exists
    console.log('📍 Ensuring stock location...')
    const stockLocationId = await ensureStockLocation(pgClient)

    // Step 2: Load product ID mappings
    console.log('\n🔗 Loading product ID mappings...')
    const productMapResult = await pgClient.query(
      `SELECT old_id, new_id FROM migration_id_map WHERE old_table = 'products'`
    )
    const productIdMap = new Map<number, string>()
    for (const row of productMapResult.rows) {
      productIdMap.set(row.old_id, row.new_id)
    }
    console.log(`   Loaded ${productIdMap.size} product mappings`)

    // Step 3: Fetch all products from MySQL
    console.log('\n📥 Reading products from MySQL...')
    const [productRows] = await mysqlConnection.query(
      'SELECT id, name, sku, price, compare_price, cost_price, stock_quantity, is_active, created_at, updated_at FROM products ORDER BY id ASC'
    )
    const oldProducts = productRows as OldProduct[]
    console.log(`   Found ${oldProducts.length} products`)

    // Step 4: Fetch size stocks (all from product_image_size_stocks joined with product_images)
    console.log('\n📥 Reading size stocks from MySQL...')
    const [sizeStockRows] = await mysqlConnection.query(
      `SELECT piss.id, piss.image_id, piss.size, piss.stock_quantity, piss.created_at, piss.updated_at,
              pi.product_id, pi.design_name, pi.sku as image_sku
       FROM product_image_size_stocks piss
       JOIN product_images pi ON piss.image_id = pi.id
       WHERE pi.status = 'ACTIVE' AND pi.deleted_at IS NULL
       ORDER BY piss.id ASC`
    )
    const sizeStocks = sizeStockRows as OldSizeStock[]
    console.log(`   Found ${sizeStocks.length} size stock entries`)

    // Group size stocks by product_id
    const sizeStocksByProduct = new Map<number, OldSizeStock[]>()
    for (const ss of sizeStocks) {
      const existing = sizeStocksByProduct.get(ss.product_id) || []
      existing.push(ss)
      sizeStocksByProduct.set(ss.product_id, existing)
    }
    const productsWithSizes = Array.from(sizeStocksByProduct.keys())
    console.log(`   Products with size stocks: ${productsWithSizes.join(', ')} (${productsWithSizes.length} product(s))`)

    // Step 5: Migrate variants
    console.log('\n💾 Creating variants...\n')

    let defaultVariants = 0
    let sizedVariants = 0
    let totalStock = 0

    for (const oldProd of oldProducts) {
      const productNewId = productIdMap.get(oldProd.id)
      if (!productNewId) {
        console.log(`   ⚠ Product ${oldProd.id} (${oldProd.name}) not found in mapping, skipping`)
        continue
      }

      const productSizeStocks = sizeStocksByProduct.get(oldProd.id)

      if (productSizeStocks && productSizeStocks.length > 0) {
        // ============================================================
        // SIZED PRODUCT: Create option + one variant per size
        // ============================================================
        if (VERBOSE) {
          console.log(`   📐 ${oldProd.name} - ${productSizeStocks.length} sized variants`)
        }

        // Create product_option "Size"
        const optionId = generateIdFromKey(`option:${productNewId}:Size`)
        await pgClient.query(
          `INSERT INTO product_option (id, title, product_id)
           VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
          [optionId, 'Size', productNewId]
        )

        // Create option values and variants
        const seenSizes = new Set<string>()
        let rank = 0

        for (const ss of productSizeStocks) {
          // Create option_value for this size (only once per unique size)
          const optionValueId = generateIdFromKey(`optval:${optionId}:${ss.size}`)
          if (!seenSizes.has(ss.size)) {
            await pgClient.query(
              `INSERT INTO product_option_value (id, value, option_id)
               VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
              [optionValueId, ss.size, optionId]
            )
            seenSizes.add(ss.size)
          }

          // Create variant: one per image+size combo
          const variantSku = ss.image_sku
            ? `${ss.image_sku}-${ss.size}`
            : `${oldProd.sku}-IMG${ss.image_id}-${ss.size}`
          const variantId = generateIdFromKey(`variant:${oldProd.id}:${ss.image_id}:${ss.size}`)
          const variantTitle = `${ss.design_name || oldProd.name} - ${ss.size}`
          const price = parseFloat(oldProd.price)

          await createVariantChain(pgClient, {
            variantId,
            productId: productNewId,
            title: variantTitle,
            sku: variantSku,
            price,
            stockQuantity: ss.stock_quantity,
            stockLocationId,
            variantRank: rank,
            metadata: {
              oldSizeStockId: ss.id,
              oldImageId: ss.image_id,
              size: ss.size,
              design_name: ss.design_name,
            },
          })

          // Link variant to option value
          await pgClient.query(
            `INSERT INTO product_variant_option (variant_id, option_value_id)
             VALUES ($1, $2) ON CONFLICT (variant_id, option_value_id) DO NOTHING`,
            [variantId, optionValueId]
          )

          totalStock += ss.stock_quantity
          sizedVariants++
          rank++

          if (VERBOSE) {
            console.log(`      ✓ ${ss.size.padEnd(5)} stock=${ss.stock_quantity} → ${variantId.substring(0, 8)}...`)
          }
        }
      } else {
        // ============================================================
        // DEFAULT PRODUCT: One variant with product-level stock/price
        // ============================================================
        const variantId = generateIdFromKey(`variant:default:${oldProd.id}`)
        const price = parseFloat(oldProd.price)

        await createVariantChain(pgClient, {
          variantId,
          productId: productNewId,
          title: 'Default',
          sku: oldProd.sku,
          price,
          stockQuantity: oldProd.stock_quantity,
          stockLocationId,
          variantRank: 0,
          metadata: {
            oldProductId: oldProd.id,
            compare_price: oldProd.compare_price,
            cost_price: oldProd.cost_price,
          },
        })

        totalStock += oldProd.stock_quantity
        defaultVariants++

        // Save variant ID mapping using old product id
        await pgClient.query(
          `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (old_table, old_id) DO NOTHING`,
          ['product_variants', oldProd.id, 'product_variant', variantId]
        )

        if (VERBOSE && defaultVariants % 20 === 0) {
          console.log(`   ... ${defaultVariants} default variants created`)
        }
      }
    }

    // Step 6: Verify migration
    console.log(`\n✅ Variant & stock migration completed!`)
    console.log(`   Default variants: ${defaultVariants}`)
    console.log(`   Sized variants: ${sizedVariants}`)
    console.log(`   Total variants: ${defaultVariants + sizedVariants}`)
    console.log(`   Total stock: ${totalStock}`)

    // Verify counts in PostgreSQL
    const variantCount = await pgClient.query('SELECT COUNT(*) as count FROM product_variant')
    console.log(`\n🔍 PostgreSQL verification:`)
    console.log(`   product_variant: ${variantCount.rows[0].count}`)

    const priceSetCount = await pgClient.query('SELECT COUNT(*) as count FROM price_set')
    console.log(`   price_set: ${priceSetCount.rows[0].count}`)

    const priceCount = await pgClient.query('SELECT COUNT(*) as count FROM price')
    console.log(`   price: ${priceCount.rows[0].count}`)

    const invItemCount = await pgClient.query('SELECT COUNT(*) as count FROM inventory_item')
    console.log(`   inventory_item: ${invItemCount.rows[0].count}`)

    const invLevelCount = await pgClient.query('SELECT COUNT(*) as count FROM inventory_level')
    console.log(`   inventory_level: ${invLevelCount.rows[0].count}`)

    const totalStockResult = await pgClient.query(
      'SELECT SUM(stocked_quantity) as total FROM inventory_level'
    )
    console.log(`   total stocked_quantity: ${totalStockResult.rows[0].total}`)

    // Products without variants (should be 0)
    const noVariant = await pgClient.query(`
      SELECT COUNT(*) as count FROM product p
      WHERE NOT EXISTS (SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id)
    `)
    console.log(`   products without variants: ${noVariant.rows[0].count}`)

  } catch (error) {
    console.error('\n❌ Variant & stock migration failed:', error)
    throw error
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 05: Migrate Variants & Stock')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    // Verify script 03 ran
    const prodCount = await pgClient.query('SELECT COUNT(*) as count FROM product')
    if (parseInt(prodCount.rows[0].count) === 0) {
      console.error('\n❌ No products found in PostgreSQL. Run script:03 first!')
      process.exit(1)
    }
    console.log(`   ✅ Found ${prodCount.rows[0].count} products (script:03 completed)`)

    await migrateVariantsAndStock(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ VARIANT & STOCK MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 06 (migrate users)')
    console.log('  npm run script:06\n')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED')
    process.exit(1)
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end()
    }
    if (pgClient) {
      await pgClient.end()
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}

export { migrateVariantsAndStock }
