/**
 * Script 14: Migrate product metadata from JSONB to dedicated table
 *
 * Phase 2 — Product Catalog
 *
 * Reads the `metadata` JSONB column from each product row and inserts a
 * corresponding `product_metadata` row with typed columns. Also creates
 * the link table row that connects product → product_metadata.
 *
 * Idempotent: ON CONFLICT (id) DO NOTHING.
 *
 * Prerequisites:
 *   - Script 03 (migrate-products) must have run
 *   - `npx medusa db:migrate` must have created product_metadata table + link table
 *
 * Usage:
 *   npx ts-node 14-migrate-product-metadata.ts
 */

import { Client as PgClient } from "pg"
import { randomUUID } from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const PG_CONFIG = {
  host: "localhost",
  port: 5432,
  database: "vaighaweaves_db_dev",
  user: "prudhviprabhat",
}

const LINK_TABLE = "product_product_productmetadata_product_metadata"

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  let pgClient: PgClient | null = null

  try {
    pgClient = new PgClient(PG_CONFIG)
    await pgClient.connect()
    console.log("✅ Connected to PostgreSQL\n")

    // 1. Fetch all products with their metadata
    const { rows: products } = await pgClient.query(
      `SELECT id, title, metadata FROM product WHERE deleted_at IS NULL ORDER BY id`
    )
    console.log(`📦 Found ${products.length} products to process\n`)

    let created = 0
    let skipped = 0
    let errors = 0

    for (const product of products) {
      const meta = product.metadata || {}
      const pmId = randomUUID().replace(/-/g, "").slice(0, 27)
      const linkId = randomUUID().replace(/-/g, "").slice(0, 27)

      try {
        // 2. Insert product_metadata row
        const insertResult = await pgClient.query(
          `INSERT INTO product_metadata (
            id, brand, tags, is_featured,
            compare_price, cost_price,
            low_stock_threshold, minimum_order_quantity,
            measuring_unit, measuring_unit_name, weight_unit,
            meta_title, meta_description, view_count,
            fabric, occasion, material, color, pattern, care_instructions,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6,
            $7, $8,
            $9, $10, $11,
            $12, $13, $14,
            $15, $16, $17, $18, $19, $20,
            NOW(), NOW()
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id`,
          [
            pmId,
            meta.brand || null,
            meta.tags || null,
            meta.is_featured === true || meta.is_featured === "true" ? true : false,
            meta.compare_price ? Math.round(Number(meta.compare_price)) : null,
            meta.cost_price ? Math.round(Number(meta.cost_price)) : null,
            meta.low_stock_threshold ? Number(meta.low_stock_threshold) : 10,
            meta.minimum_order_quantity ? Number(meta.minimum_order_quantity) : 1,
            meta.measuring_unit ? String(meta.measuring_unit) : null,
            meta.measuring_unit_name || null,
            "kg", // weight_unit default
            meta.meta_title || null,
            meta.meta_description || null,
            meta.view_count ? Number(meta.view_count) : 0,
            null, // fabric (new field, no data yet)
            null, // occasion (new field, no data yet)
            null, // material (new field, no data yet)
            null, // color (new field, no data yet)
            null, // pattern (new field, no data yet)
            null, // care_instructions (new field, no data yet)
          ]
        )

        if (insertResult.rowCount === 0) {
          // product_metadata ID already exists — try to find existing link
          skipped++
          continue
        }

        // 3. Insert link table row
        await pgClient.query(
          `INSERT INTO "${LINK_TABLE}" (
            id, product_id, product_metadata_id, created_at, updated_at
          ) VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (product_id, product_metadata_id) DO NOTHING`,
          [linkId, product.id, pmId]
        )

        created++
      } catch (err: any) {
        errors++
        console.error(`   ❌ Product ${product.id} (${product.title?.substring(0, 30)}): ${err.message}`)
      }
    }

    // 4. Summary
    console.log("\n" + "═".repeat(60))
    console.log("📊 Migration Summary")
    console.log("═".repeat(60))
    console.log(`   Products processed:  ${products.length}`)
    console.log(`   Metadata created:    ${created}`)
    console.log(`   Skipped (existing):  ${skipped}`)
    console.log(`   Errors:              ${errors}`)

    // 5. Verify counts
    const { rows: [pmCount] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM product_metadata WHERE deleted_at IS NULL`
    )
    const { rows: [linkCount] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM "${LINK_TABLE}" WHERE deleted_at IS NULL`
    )
    console.log(`\n   product_metadata rows: ${pmCount.cnt}`)
    console.log(`   Link table rows:      ${linkCount.cnt}`)

    if (Number(pmCount.cnt) === products.length && Number(linkCount.cnt) === products.length) {
      console.log("\n✅ All products have metadata records and links!")
    } else {
      console.log("\n⚠  Count mismatch — some products may be missing metadata")
    }

    console.log("\n" + "═".repeat(60))
  } catch (err) {
    console.error("❌ Fatal error:", err)
    process.exit(1)
  } finally {
    if (pgClient) await pgClient.end()
    console.log("\n🔌 Disconnected from PostgreSQL")
  }
}

main()
