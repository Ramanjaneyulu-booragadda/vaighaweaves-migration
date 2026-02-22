/**
 * SCRIPT 01: Setup Medusa Schema & ID Mapping
 *
 * Purpose:
 * - Initialize PostgreSQL database for Medusa
 * - Create ID mapping table (MySQL Int → PostgreSQL UUID)
 * - Verify connectivity to both databases
 * - Create helper functions for migrations
 *
 * Duration: ~5-10 seconds
 *
 * Run: npx ts-node 01-setup-medusa-schema.ts
 */

import { Client as PgClient } from 'pg'
import mysql from 'mysql2/promise'
import * as crypto from 'crypto'

// ============================================================================
// DATABASE CONFIGURATION
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
// INTERFACES
// ============================================================================

interface IDMapping {
  old_table: string
  old_id: number
  new_table: string
  new_id: string // Medusa v2 uses text IDs, not UUID
  created_at: Date
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a UUID v5 from old INT ID for deterministic mapping
 * This ensures same old ID always maps to same UUID
 */
function generateUUIDFromId(tableName: string, oldId: number): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' // DNS namespace
  const text = `${tableName}:${oldId}`

  // SHA1 hash (v5 uses SHA1)
  const hash = crypto
    .createHash('sha1')
    .update(namespace + text)
    .digest()

  // Format as UUID
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
 * Connect to MySQL database
 */
async function connectMySQL() {
  try {
    const connection = await mysql.createConnection(OLD_DB_CONFIG)
    console.log('✅ Connected to OLD MySQL database (Railway)')
    return connection
  } catch (error) {
    console.error('❌ Failed to connect to MySQL:', error)
    throw error
  }
}

/**
 * Connect to PostgreSQL database
 */
async function connectPostgreSQL() {
  try {
    const client = new PgClient(NEW_DB_CONFIG)
    await client.connect()
    console.log('✅ Connected to NEW PostgreSQL database (Medusa)')
    return client
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error)
    throw error
  }
}

/**
 * Create ID mapping table in PostgreSQL
 */
async function createIdMappingTable(pgClient: PgClient) {
  console.log('\n📋 Creating migration_id_map table...')

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS migration_id_map (
      id SERIAL PRIMARY KEY,
      old_table VARCHAR(50) NOT NULL,
      old_id INTEGER NOT NULL,
      new_table VARCHAR(50) NOT NULL,
      new_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(old_table, old_id)
    );

    CREATE INDEX IF NOT EXISTS idx_migration_id_map_old
      ON migration_id_map(old_table, old_id);

    CREATE INDEX IF NOT EXISTS idx_migration_id_map_new
      ON migration_id_map(new_table, new_id);
  `

  try {
    await pgClient.query(createTableSQL)
    console.log('✅ migration_id_map table created successfully')
  } catch (error) {
    console.error('❌ Failed to create migration_id_map table:', error)
    throw error
  }
}

/**
 * Create custom tables for VaighaWeaves features not in standard Medusa
 */
async function createCustomTables(pgClient: PgClient) {
  console.log('\n📋 Creating custom tables for VaighaWeaves features...')

  const customTablesSQL = `
    -- Stock Reservation table (for phone bookings + walk-ins)
    CREATE TABLE IF NOT EXISTS stock_reservation (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      staff_id TEXT NOT NULL,
      customer_id TEXT,
      product_id TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      customer_name VARCHAR(255),
      customer_phone VARCHAR(20),
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      expires_at TIMESTAMP NOT NULL,
      order_id TEXT,
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE SET NULL,
      FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stock_reservation_status
      ON stock_reservation(status);

    CREATE INDEX IF NOT EXISTS idx_stock_reservation_expires_at
      ON stock_reservation(expires_at);

    CREATE INDEX IF NOT EXISTS idx_stock_reservation_customer
      ON stock_reservation(customer_id);

    -- Custom Stock Event table (event sourcing pattern)
    CREATE TABLE IF NOT EXISTS stock_event (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      order_id TEXT,
      variant_id TEXT NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      quantity INTEGER NOT NULL,
      reason VARCHAR(100) NOT NULL,
      source VARCHAR(50) NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (variant_id) REFERENCES product_variant(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stock_event_variant
      ON stock_event(variant_id);

    CREATE INDEX IF NOT EXISTS idx_stock_event_type
      ON stock_event(event_type);

    CREATE INDEX IF NOT EXISTS idx_stock_event_created_at
      ON stock_event(created_at DESC);
  `

  try {
    await pgClient.query(customTablesSQL)
    console.log('✅ Custom tables created successfully')
  } catch (error) {
    console.error('⚠️  Some custom tables may already exist:', error)
    // Don't fail - these might already exist
  }
}

/**
 * Verify both databases are accessible and have data
 */
async function verifyDatabases(mysqlConnection: any, pgClient: PgClient) {
  console.log('\n🔍 Verifying database contents...')

  try {
    // Count tables in MySQL
    const [mysqlTables] = await mysqlConnection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?",[OLD_DB_CONFIG.database]
    )
    console.log(`✅ MySQL has ${mysqlTables[0].count} tables`)

    // Count rows in key tables
    const [productCount] = await mysqlConnection.query('SELECT COUNT(*) as count FROM products')
    const [categoryCount] = await mysqlConnection.query('SELECT COUNT(*) as count FROM categories')
    const [userCount] = await mysqlConnection.query('SELECT COUNT(*) as count FROM users')
    const [orderCount] = await mysqlConnection.query('SELECT COUNT(*) as count FROM orders')

    console.log(`   - Products: ${productCount[0].count}`)
    console.log(`   - Categories: ${categoryCount[0].count}`)
    console.log(`   - Users: ${userCount[0].count}`)
    console.log(`   - Orders: ${orderCount[0].count}`)

    // Verify PostgreSQL has Medusa tables
    const pgTablesResult = await pgClient.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    )
    console.log(`✅ PostgreSQL has ${pgTablesResult.rows[0].count} tables`)

  } catch (error) {
    console.error('❌ Verification failed:', error)
    throw error
  }
}

/**
 * Log migration statistics
 */
async function logMigrationStats(mysqlConnection: any) {
  console.log('\n📊 Data Volume Summary:')

  const tables = [
    'products',
    'categories',
    'product_images',
    'product_image_size_stock',
    'users',
    'orders',
    'order_items',
    'stock_events',
    'stock_reservation',
    'payments',
    'shipments',
  ]

  for (const table of tables) {
    try {
      const [result] = await mysqlConnection.query(
        `SELECT COUNT(*) as count FROM ${table}`
      )
      console.log(`   ${table.padEnd(30)} : ${result[0].count} rows`)
    } catch (error) {
      console.log(`   ${table.padEnd(30)} : (table not found)`)
    }
  }
}

/**
 * Export helper for other scripts
 */
export function createIdMap(
  tableName: string,
  oldId: number,
  newTable: string
): Omit<IDMapping, 'created_at'> {
  return {
    old_table: tableName,
    old_id: oldId,
    new_table: newTable,
    new_id: generateUUIDFromId(tableName, oldId),
  }
}

/**
 * Insert ID mapping
 */
export async function saveIdMapping(
  pgClient: PgClient,
  mapping: IDMapping
): Promise<void> {
  await pgClient.query(
    `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (old_table, old_id) DO NOTHING`,
    [mapping.old_table, mapping.old_id, mapping.new_table, mapping.new_id]
  )
}

/**
 * Get mapped ID
 */
export async function getMappedId(
  pgClient: PgClient,
  oldTable: string,
  oldId: number
): Promise<string | null> {
  const result = await pgClient.query(
    `SELECT new_id FROM migration_id_map
     WHERE old_table = $1 AND old_id = $2`,
    [oldTable, oldId]
  )
  return result.rows[0]?.new_id || null
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 01: Setup Medusa Schema & ID Mapping')
  console.log('================================================================================\n')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    // Connect to both databases
    console.log('🔗 Establishing database connections...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()

    // Verify connectivity
    await verifyDatabases(mysqlConnection, pgClient!)

    // Create ID mapping table
    await createIdMappingTable(pgClient!)

    // Create custom tables
    await createCustomTables(pgClient!)

    // Log data volume
    await logMigrationStats(mysqlConnection)

    console.log('\n================================================================================')
    console.log('✅ SETUP COMPLETE - Ready for data migration!')
    console.log('================================================================================\n')
    console.log('Next steps:')
    console.log('  1. Run: npm run script 02 (migrate categories)')
    console.log('  2. Run: npm run script 03 (migrate products)')
    console.log('  3. Continue with remaining scripts in sequence\n')

  } catch (error) {
    console.error('\n❌ SETUP FAILED')
    console.error('Error:', error)
    process.exit(1)
  } finally {
    // Clean up connections
    if (mysqlConnection) {
      await mysqlConnection.end()
    }
    if (pgClient) {
      await pgClient!.end()
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}

export { connectMySQL, connectPostgreSQL }
