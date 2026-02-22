/**
 * SCRIPT 02: Migrate Categories
 *
 * Purpose:
 * - Migrate Category → ProductCategory (hierarchical structure preserved)
 * - Handle parent-child relationships
 * - Create category handles from slugs
 *
 * Complexity: ⭐ EASY (no dependencies)
 * Duration: ~10-15 seconds
 *
 * Run: npm run script:02
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

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100')
const VERBOSE = process.env.VERBOSE !== 'false'

// ============================================================================
// TYPES
// ============================================================================

interface OldCategory {
  id: number
  name: string
  slug: string
  description: string | null
  parent_id: number | null
  is_active: number // tinyint(1) in MySQL
  sort_order: number
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

interface NewCategory {
  id: string // text ID (Medusa v2 uses text, not UUID)
  name: string
  description: string
  handle: string // slug
  mpath: string // materialized path for hierarchy
  parent_category_id: string | null
  is_active: boolean
  is_internal: boolean
  rank: number
  metadata: {
    oldCategoryId: number
    slug: string
  }
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

async function migrateCategories(
  mysqlConnection: any,
  pgClient: PgClient
): Promise<void> {
  console.log('\n📂 Starting category migration...\n')

  try {
    // Step 1: Fetch all categories from MySQL
    console.log('📥 Reading categories from MySQL...')
    const [rows] = await mysqlConnection.query(
      'SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY id ASC'
    )
    const oldCategories = rows as OldCategory[]
    console.log(`   Found ${oldCategories.length} categories`)

    if (oldCategories.length === 0) {
      console.log('   ⚠️  No categories found to migrate')
      return
    }

    // Step 2: Create ID mapping map for parent-child relationships
    console.log('\n🔗 Building ID mappings...')
    const idMap = new Map<number, string>() // old_id → new_id
    const mpathMap = new Map<string, string>() // new_id → mpath
    oldCategories.forEach(cat => {
      const newId = generateUUIDFromId('categories', cat.id)
      idMap.set(cat.id, newId)
    })

    // Step 3: Sort categories so parents come before children
    // Root categories first, then children
    const rootCategories = oldCategories.filter(c => !c.parent_id)
    const childCategories = oldCategories.filter(c => c.parent_id)

    // Build mpath for roots first
    for (const cat of rootCategories) {
      const newId = idMap.get(cat.id)!
      mpathMap.set(newId, newId)
    }

    // Build mpath for children (parent mpath + child id)
    // Handle multi-level nesting by iterating until all are resolved
    const remaining = [...childCategories]
    let maxIterations = 10
    while (remaining.length > 0 && maxIterations-- > 0) {
      const stillRemaining: OldCategory[] = []
      for (const cat of remaining) {
        const newId = idMap.get(cat.id)!
        const parentNewId = idMap.get(cat.parent_id!)
        if (parentNewId && mpathMap.has(parentNewId)) {
          mpathMap.set(newId, `${mpathMap.get(parentNewId)}.${newId}`)
        } else {
          stillRemaining.push(cat)
        }
      }
      remaining.length = 0
      remaining.push(...stillRemaining)
    }

    // Step 4: Insert categories into PostgreSQL (roots first, then children)
    console.log('\n💾 Inserting categories into PostgreSQL...')

    const sortedCategories = [...rootCategories, ...childCategories]
    let inserted = 0

    for (const oldCat of sortedCategories) {
      const newId = idMap.get(oldCat.id)!
      const parentNewId = oldCat.parent_id ? idMap.get(oldCat.parent_id) : null
      const mpath = mpathMap.get(newId) || newId

      const newCategory: NewCategory = {
        id: newId,
        name: oldCat.name,
        description: oldCat.description || '',
        handle: oldCat.slug,
        mpath: mpath,
        parent_category_id: parentNewId || null,
        is_active: Boolean(oldCat.is_active),
        is_internal: false,
        rank: oldCat.sort_order,
        metadata: {
          oldCategoryId: oldCat.id,
          slug: oldCat.slug,
        },
      }

      try {
        await pgClient.query(
          `INSERT INTO product_category (
            id, name, description, handle, mpath, parent_category_id, is_active, is_internal, rank, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING`,
          [
            newCategory.id,
            newCategory.name,
            newCategory.description,
            newCategory.handle,
            newCategory.mpath,
            newCategory.parent_category_id,
            newCategory.is_active,
            newCategory.is_internal,
            newCategory.rank,
            JSON.stringify(newCategory.metadata),
          ]
        )

        // Save ID mapping
        await pgClient.query(
          `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (old_table, old_id) DO NOTHING`,
          ['categories', oldCat.id, 'product_category', newId]
        )

        inserted++
        if (VERBOSE) {
          const parentInfo = oldCat.parent_id ? `(child of ${oldCat.parent_id})` : '(root)'
          console.log(
            `   ✓ ${oldCat.name.padEnd(30)} ${parentInfo.padEnd(18)} → ${newId.substring(0, 8)}...`
          )
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to insert category ${oldCat.id} (${oldCat.name}):`, error.message)
        throw error
      }
    }

    console.log(`\n   Inserted ${inserted} of ${oldCategories.length} categories`)

    // Step 4: Verify migration
    console.log('\n✅ Category migration completed!')
    const result = await pgClient.query(
      'SELECT COUNT(*) as count FROM product_category'
    )
    console.log(`   Total categories in PostgreSQL: ${result.rows[0].count}`)

    // Step 5: Verify hierarchy
    console.log('\n🔍 Verifying parent-child relationships...')
    const hierarchyResult = await pgClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN parent_category_id IS NULL THEN 1 END) as root_categories,
        COUNT(CASE WHEN parent_category_id IS NOT NULL THEN 1 END) as child_categories
      FROM product_category
    `)
    const stats = hierarchyResult.rows[0]
    console.log(`   Root categories: ${stats.root_categories}`)
    console.log(`   Child categories: ${stats.child_categories}`)

  } catch (error) {
    console.error('\n❌ Category migration failed:', error)
    throw error
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 02: Migrate Categories')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    // Connect to databases
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    // Run migration
    await migrateCategories(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ CATEGORY MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 03 (migrate products)')
    console.log('  npm run script:03\n')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED')
    process.exit(1)
  } finally {
    // Clean up
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

export { migrateCategories }
