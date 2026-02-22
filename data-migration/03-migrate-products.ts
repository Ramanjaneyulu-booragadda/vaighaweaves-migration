/**
 * SCRIPT 03: Migrate Products
 *
 * Purpose:
 * - Migrate products from MySQL to Medusa product table
 * - Link products to categories via product_category_product join table
 * - Map is_active → status (published/draft)
 * - Preserve custom fields (brand, tags, sku, etc.) in metadata
 *
 * Complexity: ⭐⭐ MEDIUM (category FK resolution + join table)
 * Duration: ~15-30 seconds
 *
 * Prerequisites: Scripts 01 and 02 must have run successfully
 *
 * Run: npm run script:03
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
// TYPES (MySQL columns are snake_case - mysql2 returns as-is)
// ============================================================================

interface OldProduct {
  id: number
  name: string
  slug: string
  description: string | null
  sku: string
  price: string // decimal comes as string from mysql2
  compare_price: string | null
  cost_price: string | null
  category_id: number
  brand: string | null
  stock_quantity: number
  low_stock_threshold: number
  weight: string | null // decimal
  dimensions: string | null
  is_active: number // tinyint(1)
  is_featured: number // tinyint(1)
  tags: string | null
  meta_title: string | null
  meta_description: string | null
  view_count: number
  minimum_order_quantity: number | null
  weight_unit: string | null
  measuring_unit: string | null // decimal
  measuring_unit_name: string | null
  created_at: Date
  updated_at: Date
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
// MAIN MIGRATION
// ============================================================================

async function migrateProducts(
  mysqlConnection: any,
  pgClient: PgClient
): Promise<void> {
  console.log('\n📦 Starting product migration...\n')

  try {
    // Step 1: Fetch all products from MySQL
    // Note: products table has NO deleted_at column, so no soft-delete filter needed
    console.log('📥 Reading products from MySQL...')
    const [rows] = await mysqlConnection.query(
      'SELECT * FROM products ORDER BY id ASC'
    )
    const oldProducts = rows as OldProduct[]
    console.log(`   Found ${oldProducts.length} products (${oldProducts.filter(p => p.is_active).length} active, ${oldProducts.filter(p => !p.is_active).length} inactive)`)

    if (oldProducts.length === 0) {
      console.log('   ⚠️  No products found to migrate')
      return
    }

    // Step 2: Load category ID mappings from migration_id_map
    console.log('\n🔗 Loading category ID mappings...')
    const categoryMapResult = await pgClient.query(
      `SELECT old_id, new_id FROM migration_id_map WHERE old_table = 'categories'`
    )
    const categoryIdMap = new Map<number, string>()
    for (const row of categoryMapResult.rows) {
      categoryIdMap.set(row.old_id, row.new_id)
    }
    console.log(`   Loaded ${categoryIdMap.size} category mappings`)

    // Step 3: Insert products into PostgreSQL
    console.log('\n💾 Inserting products into PostgreSQL...')

    let inserted = 0
    let skippedNoCategory = 0
    let linkedToCategory = 0

    for (const oldProd of oldProducts) {
      const newId = generateUUIDFromId('products', oldProd.id)
      const categoryNewId = categoryIdMap.get(oldProd.category_id)

      if (!categoryNewId) {
        skippedNoCategory++
        if (VERBOSE) {
          console.log(`   ⚠ ${oldProd.name.substring(0, 40).padEnd(40)} - category ${oldProd.category_id} not found (soft-deleted?), inserting without category`)
        }
      }

      // Map is_active to Medusa status
      const status = oldProd.is_active ? 'published' : 'draft'

      // Preserve all custom fields in metadata
      const metadata: Record<string, any> = {
        oldProductId: oldProd.id,
        sku: oldProd.sku,
        brand: oldProd.brand,
        tags: oldProd.tags,
        is_featured: Boolean(oldProd.is_featured),
        view_count: oldProd.view_count,
        meta_title: oldProd.meta_title,
        meta_description: oldProd.meta_description,
        compare_price: oldProd.compare_price,
        cost_price: oldProd.cost_price,
        low_stock_threshold: oldProd.low_stock_threshold,
        minimum_order_quantity: oldProd.minimum_order_quantity,
        measuring_unit: oldProd.measuring_unit,
        measuring_unit_name: oldProd.measuring_unit_name,
        old_stock_quantity: oldProd.stock_quantity,
      }

      try {
        // Insert into product table
        await pgClient.query(
          `INSERT INTO product (
            id, title, handle, description, status, is_giftcard, discountable,
            weight, origin_country, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING`,
          [
            newId,
            oldProd.name,
            oldProd.slug,
            oldProd.description || '',
            status,
            false, // is_giftcard
            true,  // discountable
            oldProd.weight ? String(oldProd.weight) : null,
            'IN', // origin_country - India
            JSON.stringify(metadata),
            oldProd.created_at,
            oldProd.updated_at,
          ]
        )

        // Link product to category via join table
        if (categoryNewId) {
          await pgClient.query(
            `INSERT INTO product_category_product (product_id, product_category_id)
             VALUES ($1, $2)
             ON CONFLICT (product_id, product_category_id) DO NOTHING`,
            [newId, categoryNewId]
          )
          linkedToCategory++
        }

        // Save ID mapping
        await pgClient.query(
          `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (old_table, old_id) DO NOTHING`,
          ['products', oldProd.id, 'product', newId]
        )

        inserted++
        if (VERBOSE) {
          const catInfo = categoryNewId ? `cat:${oldProd.category_id}` : 'NO CAT'
          console.log(
            `   ✓ ${oldProd.name.substring(0, 45).padEnd(45)} [${status.padEnd(9)}] ${catInfo.padEnd(8)} → ${newId.substring(0, 8)}...`
          )
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to insert product ${oldProd.id} (${oldProd.name}):`, error.message)
        throw error
      }
    }

    // Step 4: Verify migration
    console.log(`\n   Inserted ${inserted} of ${oldProducts.length} products`)
    if (skippedNoCategory > 0) {
      console.log(`   ⚠️  ${skippedNoCategory} products had no matching category (inserted without category link)`)
    }
    console.log(`   🔗 ${linkedToCategory} products linked to categories`)

    console.log('\n✅ Product migration completed!')

    // Verify counts
    const productCount = await pgClient.query('SELECT COUNT(*) as count FROM product')
    console.log(`   Total products in PostgreSQL: ${productCount.rows[0].count}`)

    const linkCount = await pgClient.query('SELECT COUNT(*) as count FROM product_category_product')
    console.log(`   Total product-category links: ${linkCount.rows[0].count}`)

    // Verify by status
    const statusResult = await pgClient.query(`
      SELECT status, COUNT(*) as count
      FROM product
      GROUP BY status
      ORDER BY status
    `)
    console.log('\n🔍 Products by status:')
    for (const row of statusResult.rows) {
      console.log(`   ${row.status}: ${row.count}`)
    }

    // Verify ID mapping count
    const mappingCount = await pgClient.query(
      `SELECT COUNT(*) as count FROM migration_id_map WHERE old_table = 'products'`
    )
    console.log(`\n   ID mappings saved: ${mappingCount.rows[0].count}`)

  } catch (error) {
    console.error('\n❌ Product migration failed:', error)
    throw error
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 03: Migrate Products')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    // Verify script 02 ran (categories must exist)
    const catCount = await pgClient.query('SELECT COUNT(*) as count FROM product_category')
    if (parseInt(catCount.rows[0].count) === 0) {
      console.error('\n❌ No categories found in PostgreSQL. Run script:02 first!')
      process.exit(1)
    }
    console.log(`   ✅ Found ${catCount.rows[0].count} categories (script:02 completed)`)

    await migrateProducts(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ PRODUCT MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 04 (migrate images)')
    console.log('  npm run script:04\n')

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

export { migrateProducts }
