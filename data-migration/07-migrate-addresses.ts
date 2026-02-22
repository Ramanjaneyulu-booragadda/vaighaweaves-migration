/**
 * SCRIPT 07: Migrate Addresses
 *
 * Purpose:
 * - Migrate customer shipping addresses from MySQL `addresses` table → Medusa `customer_address`
 * - Link each address to the correct Medusa customer via migration_id_map
 * - Map `is_default` → `is_default_shipping` (and `is_default_billing` for default addresses)
 * - Split `full_name` into `first_name` + `last_name`
 * - Normalize `country` string → ISO 2-letter `country_code` (India → "in")
 * - Addresses for users not found in migration_id_map (e.g., deleted/skipped users) are skipped
 *
 * Source data:
 * - 615 addresses, all rows (no deleted_at column)
 * - user_id is a FK to users.id
 * - country is always "India" in current data
 *
 * Medusa schema:
 * - `customer_address` table
 * - customer_id (TEXT, FK to customer.id, NOT NULL)
 * - first_name, last_name, address_1, address_2, city, province, postal_code, country_code, phone
 * - is_default_shipping (BOOLEAN, NOT NULL, default false)
 * - is_default_billing  (BOOLEAN, NOT NULL, default false)
 * - metadata (JSONB)
 *
 * Complexity: ⭐⭐ MEDIUM
 * Duration: ~10-20 seconds
 *
 * Run: npm run script:07
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
// TYPES (MySQL snake_case column names)
// ============================================================================

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

/**
 * Split "First Last" into { firstName, lastName }.
 * If only one word, it goes to first_name and last_name is ''.
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }
  const firstName = parts.slice(0, -1).join(' ')
  const lastName = parts[parts.length - 1]
  return { firstName, lastName }
}

/**
 * Normalize country string → ISO 2-letter code (lowercase).
 * Handles "India", "india", "IN", etc.
 */
function normalizeCountryCode(country: string): string {
  const c = (country || '').trim().toLowerCase()
  if (c === 'india' || c === 'in') return 'in'
  // Fallback: return first 2 chars lowercased
  return c.substring(0, 2) || 'in'
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

async function migrateAddresses(
  mysqlConnection: any,
  pgClient: PgClient
): Promise<void> {
  console.log('\n🏠 Starting address migration...\n')

  // Step 1: Fetch all addresses from MySQL
  console.log('📥 Reading addresses from MySQL...')
  const [rows] = await mysqlConnection.query(
    'SELECT * FROM addresses ORDER BY id ASC'
  )
  const oldAddresses = rows as OldAddress[]
  console.log(`   Found ${oldAddresses.length} addresses`)

  // Step 2: Load user_id → customer_id mappings from migration_id_map
  console.log('📥 Loading user ID mappings from migration_id_map...')
  const mappingRes = await pgClient.query<{ old_id: number; new_id: string }>(
    `SELECT old_id::int AS old_id, new_id FROM migration_id_map WHERE old_table = 'users' AND new_table = 'customer'`
  )
  const userIdMap = new Map<number, string>()
  for (const row of mappingRes.rows) {
    userIdMap.set(row.old_id, row.new_id)
  }
  console.log(`   Loaded ${userIdMap.size} user→customer mappings`)

  // Step 3: Insert addresses
  console.log('\n💾 Inserting addresses into Medusa customer_address...')
  let inserted = 0
  let skipped = 0

  for (const addr of oldAddresses) {
    const customerId = userIdMap.get(addr.user_id)
    if (!customerId) {
      // User was an admin (mapped to `user` table) or not migrated — skip
      if (VERBOSE) {
        console.log(`   ⚠️  Skipping address ${addr.id} — user_id ${addr.user_id} not in customer map`)
      }
      skipped++
      continue
    }

    const newId = generateUUIDFromId('addresses', addr.id)
    const { firstName, lastName } = splitFullName(addr.full_name)
    const countryCode = normalizeCountryCode(addr.country)
    const isDefault = Boolean(addr.is_default)

    const metadata = {
      oldAddressId: addr.id,
      oldUserId: addr.user_id,
      originalFullName: addr.full_name,
      originalCountry: addr.country,
    }

    try {
      await pgClient.query(
        `INSERT INTO customer_address (
          id,
          customer_id,
          first_name,
          last_name,
          phone,
          address_1,
          address_2,
          city,
          province,
          postal_code,
          country_code,
          is_default_shipping,
          is_default_billing,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO NOTHING`,
        [
          newId,
          customerId,
          firstName,
          lastName,
          addr.phone,
          addr.address_line1,
          addr.address_line2 || null,
          addr.city,
          addr.state,        // province in Medusa = state in India
          addr.postal_code,
          countryCode,
          isDefault,         // is_default_shipping
          isDefault,         // is_default_billing (same flag in old system)
          JSON.stringify(metadata),
          addr.created_at,
          addr.updated_at,
        ]
      )

      // Save ID mapping
      await pgClient.query(
        `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (old_table, old_id) DO NOTHING`,
        ['addresses', addr.id, 'customer_address', newId]
      )

      inserted++
      if (VERBOSE && inserted % 100 === 0) {
        console.log(`   ... ${inserted} addresses inserted`)
      }
    } catch (error: any) {
      console.error(`   ✗ Failed to insert address ${addr.id}:`, error.message)
      throw error
    }
  }

  console.log(`   ✅ Inserted ${inserted} addresses`)
  if (skipped > 0) {
    console.log(`   ⚠️  Skipped ${skipped} addresses (admin users or unmapped user_ids)`)
  }

  // Step 4: Verify
  console.log('\n🔍 Verifying...')
  const pgCount = await pgClient.query('SELECT COUNT(*) as count FROM customer_address WHERE deleted_at IS NULL')
  console.log(`   customer_address rows in PostgreSQL: ${pgCount.rows[0].count}`)

  const mapCount = await pgClient.query(
    `SELECT COUNT(*) as count FROM migration_id_map WHERE old_table = 'addresses'`
  )
  console.log(`   ID mappings saved: ${mapCount.rows[0].count}`)

  const defaultCount = await pgClient.query(
    `SELECT COUNT(*) as count FROM customer_address WHERE is_default_shipping = true`
  )
  console.log(`   Default shipping addresses: ${defaultCount.rows[0].count}`)
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 07: Migrate Addresses')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    await migrateAddresses(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ ADDRESS MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 08 (migrate orders)')
    console.log('  npm run script:08\n')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error)
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

export { migrateAddresses }
