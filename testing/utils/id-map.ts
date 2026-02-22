/**
 * Load migration_id_map from PostgreSQL to cross-reference
 * old MySQL IDs with new Medusa UUIDs.
 *
 * The migration_id_map table was populated by the 13 data-migration
 * scripts with ~7,631 entries covering products, categories, users,
 * orders, payments, variants, etc.
 */

import { Client } from "pg"
import * as dotenv from "dotenv"

dotenv.config()

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://prudhviprabhat@localhost:5432/vaighaweaves_db_dev"

export type IdMapping = Map<string, string>

/**
 * Load ID mappings for a specific entity type.
 *
 * @param entityType - The entity type as stored in migration_id_map
 *   (e.g., "products", "orders", "users", "product_variants", "payments")
 * @returns Map<oldId, newId>
 */
export async function loadIdMap(entityType: string): Promise<IdMapping> {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const result = await client.query(
      `SELECT old_id, new_id FROM migration_id_map WHERE old_table = $1`,
      [entityType]
    )

    const map: IdMapping = new Map()
    for (const row of result.rows) {
      map.set(String(row.old_id), String(row.new_id))
    }

    return map
  } finally {
    await client.end()
  }
}

/**
 * Load multiple entity type mappings at once.
 */
export async function loadIdMaps(
  entityTypes: string[]
): Promise<Record<string, IdMapping>> {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const result = await client.query(
      `SELECT old_table, old_id, new_id FROM migration_id_map WHERE old_table = ANY($1)`,
      [entityTypes]
    )

    const maps: Record<string, IdMapping> = {}
    for (const type of entityTypes) {
      maps[type] = new Map()
    }

    for (const row of result.rows) {
      maps[row.old_table]?.set(String(row.old_id), String(row.new_id))
    }

    return maps
  } finally {
    await client.end()
  }
}

/**
 * Reverse lookup: given a new Medusa ID, find the old MySQL ID.
 */
export async function reverseIdMap(entityType: string): Promise<IdMapping> {
  const forward = await loadIdMap(entityType)
  const reverse: IdMapping = new Map()
  for (const [oldId, newId] of forward) {
    reverse.set(newId, oldId)
  }
  return reverse
}
