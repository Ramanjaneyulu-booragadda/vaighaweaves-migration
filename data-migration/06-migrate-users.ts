/**
 * SCRIPT 06: Migrate Users
 *
 * Purpose:
 * - Migrate customer users → Medusa `customer` table (has_account = true)
 * - Migrate admin users → Medusa `user` table
 * - Preserve phone, whatsapp, username, etc. in metadata
 * - Password hashes are NOT migrated (users will use Medusa auth or reset)
 *
 * Source data:
 * - 2569 customers + 4 administrators = 2573 total
 * - No deleted_at column on users table (all rows migrated)
 * - No duplicate emails
 * - 8 users have null first_name
 *
 * Medusa schema notes:
 * - `customer` has UNIQUE index on (email, has_account) where deleted_at IS NULL
 * - `user` has UNIQUE index on email where deleted_at IS NULL
 * - `user.email` is NOT NULL; `customer.email` is nullable
 *
 * Complexity: ⭐⭐ MEDIUM (two target tables, role-based split)
 * Duration: ~30-60 seconds
 *
 * Run: npm run script:06
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
// TYPES (MySQL snake_case)
// ============================================================================

interface OldUser {
  id: number
  username: string
  email: string
  password: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: string
  is_active: number
  created_at: Date
  updated_at: Date
  last_login: Date | null
  provider: string | null
  provider_id: string | null
  email_verified: number
  whatsapp_number: string | null
  whatsapp_consent: number
  whatsapp_consent_date: Date | null
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

async function migrateUsers(
  mysqlConnection: any,
  pgClient: PgClient
): Promise<void> {
  console.log('\n👥 Starting user migration...\n')

  try {
    // Step 1: Fetch all users from MySQL (no deleted_at column)
    console.log('📥 Reading users from MySQL...')
    const [rows] = await mysqlConnection.query(
      'SELECT * FROM users ORDER BY id ASC'
    )
    const oldUsers = rows as OldUser[]

    const customers = oldUsers.filter(u => u.role !== 'administrator')
    const admins = oldUsers.filter(u => u.role === 'administrator')
    console.log(`   Found ${oldUsers.length} users (${customers.length} customers, ${admins.length} admins)`)

    // Step 2: Migrate customers → customer table
    console.log('\n💾 Migrating customers...')
    let customerInserted = 0

    for (const user of customers) {
      const newId = generateUUIDFromId('users', user.id)

      const metadata: Record<string, any> = {
        oldUserId: user.id,
        username: user.username,
        role: user.role,
        is_active: Boolean(user.is_active),
        email_verified: Boolean(user.email_verified),
        last_login: user.last_login,
        provider: user.provider,
        provider_id: user.provider_id,
        whatsapp_number: user.whatsapp_number,
        whatsapp_consent: Boolean(user.whatsapp_consent),
        whatsapp_consent_date: user.whatsapp_consent_date,
      }

      try {
        await pgClient.query(
          `INSERT INTO customer (
            id, email, first_name, last_name, phone, has_account, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING`,
          [
            newId,
            user.email,
            user.first_name || '',
            user.last_name || '',
            user.phone,
            true,
            JSON.stringify(metadata),
            user.created_at,
            user.updated_at,
          ]
        )

        // Save ID mapping
        await pgClient.query(
          `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (old_table, old_id) DO NOTHING`,
          ['users', user.id, 'customer', newId]
        )

        customerInserted++
        if (VERBOSE && customerInserted % 500 === 0) {
          console.log(`   ... ${customerInserted} customers inserted`)
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to insert customer ${user.id} (${user.email}):`, error.message)
        throw error
      }
    }
    console.log(`   ✅ Inserted ${customerInserted} customers`)

    // Step 3: Migrate admins → user table
    console.log('\n💾 Migrating admin users...')
    let adminInserted = 0

    for (const user of admins) {
      const newId = generateUUIDFromId('users', user.id)

      const metadata: Record<string, any> = {
        oldUserId: user.id,
        username: user.username,
        role: user.role,
        is_active: Boolean(user.is_active),
        email_verified: Boolean(user.email_verified),
        last_login: user.last_login,
        phone: user.phone,
        whatsapp_number: user.whatsapp_number,
      }

      try {
        // Check if email already exists (e.g., created during Medusa setup)
        const existing = await pgClient.query(
          `SELECT id FROM "user" WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
          [user.email]
        )

        let mappedId: string
        if (existing.rows.length > 0) {
          // Email already exists - map to existing Medusa user
          mappedId = existing.rows[0].id
          if (VERBOSE) {
            console.log(`   ↳ ${user.email.padEnd(35)} already exists → ${mappedId.substring(0, 8)}... (mapped)`)
          }
        } else {
          // Insert new admin user
          mappedId = newId
          await pgClient.query(
            `INSERT INTO "user" (
              id, email, first_name, last_name, metadata, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING`,
            [
              newId,
              user.email,
              user.first_name || '',
              user.last_name || '',
              JSON.stringify(metadata),
              user.created_at,
              user.updated_at,
            ]
          )
        }

        // Save ID mapping (use actual Medusa id, which may differ from our generated one)
        await pgClient.query(
          `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (old_table, old_id) DO NOTHING`,
          ['users', user.id, 'user', mappedId]
        )

        adminInserted++
        if (VERBOSE) {
          console.log(`   ✓ ${user.email.padEnd(35)} (${user.first_name} ${user.last_name}) → ${newId.substring(0, 8)}...`)
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to insert admin ${user.id} (${user.email}):`, error.message)
        throw error
      }
    }
    console.log(`   ✅ Inserted ${adminInserted} admin users`)

    // Step 4: Verify migration
    console.log('\n✅ User migration completed!')

    const custCount = await pgClient.query('SELECT COUNT(*) as count FROM customer')
    console.log(`   Customers in PostgreSQL: ${custCount.rows[0].count}`)

    const userCount = await pgClient.query('SELECT COUNT(*) as count FROM "user"')
    console.log(`   Admin users in PostgreSQL: ${userCount.rows[0].count}`)

    const withAccount = await pgClient.query(
      `SELECT COUNT(*) as count FROM customer WHERE has_account = true`
    )
    console.log(`   Customers with accounts: ${withAccount.rows[0].count}`)

    const mappingCount = await pgClient.query(
      `SELECT new_table, COUNT(*) as count FROM migration_id_map WHERE old_table = 'users' GROUP BY new_table ORDER BY new_table`
    )
    console.log('\n   ID mappings saved:')
    for (const row of mappingCount.rows) {
      console.log(`     ${row.new_table}: ${row.count}`)
    }

  } catch (error) {
    console.error('\n❌ User migration failed:', error)
    throw error
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 06: Migrate Users')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    await migrateUsers(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ USER MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 07 (migrate addresses)')
    console.log('  npm run script:07\n')

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

export { migrateUsers }
