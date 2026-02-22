/**
 * Script 16: Verify Phase 2 — Product Catalog
 *
 * Checks data integrity for:
 *   - product_metadata records (117 expected)
 *   - product ↔ product_metadata link table rows
 *   - Spot-check metadata field values against product.metadata JSONB
 *   - Categories accessible (92 expected)
 *   - Images in image table (1,311 expected)
 *   - image_variant records (after backfill)
 *
 * Usage:
 *   npx ts-node 16-verify-phase2.ts
 */

import { Client as PgClient } from "pg"

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

// Expected counts
const EXPECTED = {
  products: 117,
  categories: 92,
  images: 1311,
  productMetadata: 117,
  linkRows: 117,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
const failures: string[] = []

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    const msg = detail ? `${name} — ${detail}` : name
    console.log(`  ❌ ${msg}`)
    failed++
    failures.push(msg)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  let pgClient: PgClient | null = null

  console.log("╔══════════════════════════════════════════════════════════════╗")
  console.log("║  Script 16: Verify Phase 2 — Product Catalog               ║")
  console.log("╚══════════════════════════════════════════════════════════════╝")
  console.log()

  try {
    pgClient = new PgClient(PG_CONFIG)
    await pgClient.connect()
    console.log("✅ PostgreSQL connected\n")

    // ───────────────────────────────────────────────────────────────────────
    // 1. Core data counts (carried from Phase 1)
    // ───────────────────────────────────────────────────────────────────────
    console.log("── 1. Core Data Counts ──────────────────────────────────────")

    const { rows: [{ cnt: productCount }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM product WHERE deleted_at IS NULL`
    )
    check(
      `Products: ${productCount}`,
      parseInt(productCount) >= EXPECTED.products,
      `Expected ≥${EXPECTED.products}, got ${productCount}`
    )

    const { rows: [{ cnt: categoryCount }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM product_category WHERE deleted_at IS NULL`
    )
    check(
      `Categories: ${categoryCount}`,
      parseInt(categoryCount) >= EXPECTED.categories,
      `Expected ≥${EXPECTED.categories}, got ${categoryCount}`
    )

    const { rows: [{ cnt: imageCount }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM image WHERE deleted_at IS NULL`
    )
    check(
      `Images: ${imageCount}`,
      parseInt(imageCount) >= EXPECTED.images,
      `Expected ≥${EXPECTED.images}, got ${imageCount}`
    )

    console.log()

    // ───────────────────────────────────────────────────────────────────────
    // 2. Product Metadata Module
    // ───────────────────────────────────────────────────────────────────────
    console.log("── 2. Product Metadata ─────────────────────────────────────")

    const { rows: [{ cnt: metadataCount }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM product_metadata WHERE deleted_at IS NULL`
    )
    check(
      `product_metadata rows: ${metadataCount}`,
      parseInt(metadataCount) >= EXPECTED.productMetadata,
      `Expected ≥${EXPECTED.productMetadata}, got ${metadataCount}`
    )

    const { rows: [{ cnt: linkCount }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM "${LINK_TABLE}" WHERE deleted_at IS NULL`
    )
    check(
      `Link table rows: ${linkCount}`,
      parseInt(linkCount) >= EXPECTED.linkRows,
      `Expected ≥${EXPECTED.linkRows}, got ${linkCount}`
    )

    // Check every product has a metadata record
    const { rows: [{ cnt: orphanProducts }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM product p
       WHERE p.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM "${LINK_TABLE}" l
         WHERE l.product_id = p.id AND l.deleted_at IS NULL
       )`
    )
    check(
      `Products without metadata link: ${orphanProducts}`,
      parseInt(orphanProducts) === 0,
      `${orphanProducts} products missing metadata link`
    )

    console.log()

    // ───────────────────────────────────────────────────────────────────────
    // 3. Spot-check metadata values
    // ───────────────────────────────────────────────────────────────────────
    console.log("── 3. Spot-Check Metadata Values ───────────────────────────")

    // Pick 10 random products and verify metadata matches JSONB
    const { rows: spotCheckRows } = await pgClient.query(
      `SELECT p.id as product_id, p.metadata as jsonb_meta,
              pm.brand, pm.tags, pm.is_featured, pm.meta_title,
              pm.view_count, pm.low_stock_threshold, pm.weight_unit
       FROM product p
       JOIN "${LINK_TABLE}" l ON l.product_id = p.id AND l.deleted_at IS NULL
       JOIN product_metadata pm ON pm.id = l.product_metadata_id AND pm.deleted_at IS NULL
       WHERE p.deleted_at IS NULL
       ORDER BY RANDOM()
       LIMIT 10`
    )

    let spotCheckPassed = 0
    for (const row of spotCheckRows) {
      const jsonb = row.jsonb_meta || {}
      let ok = true

      // Check brand matches (if present in JSONB)
      if (jsonb.brand && row.brand !== jsonb.brand) {
        console.log(`    MISMATCH product ${row.product_id}: brand "${row.brand}" vs JSONB "${jsonb.brand}"`)
        ok = false
      }

      // Check tags
      if (jsonb.tags && row.tags !== jsonb.tags) {
        console.log(`    MISMATCH product ${row.product_id}: tags "${row.tags}" vs JSONB "${jsonb.tags}"`)
        ok = false
      }

      // Check defaults
      if (row.low_stock_threshold === null || row.low_stock_threshold === undefined) {
        console.log(`    MISSING product ${row.product_id}: low_stock_threshold is null`)
        ok = false
      }

      if (ok) spotCheckPassed++
    }

    check(
      `Spot-check: ${spotCheckPassed}/${spotCheckRows.length} products match`,
      spotCheckPassed === spotCheckRows.length,
      `${spotCheckRows.length - spotCheckPassed} mismatches`
    )

    // Check weight_unit default is applied (all should be 'kg')
    const { rows: [{ cnt: kgCount }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM product_metadata
       WHERE deleted_at IS NULL AND weight_unit = 'kg'`
    )
    check(
      `Products with weight_unit='kg': ${kgCount}/${metadataCount}`,
      parseInt(kgCount) === parseInt(metadataCount),
      `Expected all ${metadataCount} to have weight_unit='kg', got ${kgCount}`
    )

    // Check no nulls in required default fields
    const { rows: [{ cnt: nullDefaults }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM product_metadata
       WHERE deleted_at IS NULL
       AND (low_stock_threshold IS NULL OR minimum_order_quantity IS NULL)`
    )
    check(
      `Products with null required defaults: ${nullDefaults}`,
      parseInt(nullDefaults) === 0,
      `${nullDefaults} products have null low_stock_threshold or minimum_order_quantity`
    )

    console.log()

    // ───────────────────────────────────────────────────────────────────────
    // 4. Image Variant (Optimizer) Module
    // ───────────────────────────────────────────────────────────────────────
    console.log("── 4. Image Variants (Optimizer) ───────────────────────────")

    const { rows: [{ cnt: variantCount }] } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM image_variant WHERE deleted_at IS NULL`
    )
    console.log(`  📊 image_variant rows: ${variantCount}`)

    if (parseInt(variantCount) === 0) {
      console.log("  ℹ️  No image variants yet — run script 15 (backfill) first")
      console.log("     npx ts-node 15-backfill-responsive-images.ts")
    } else {
      // Expected: ~4 variants per image (some may have fewer if small)
      const expectedMin = Math.floor(parseInt(imageCount) * 2) // at least 2 sizes each on average
      check(
        `Image variant count ${variantCount} (expected ≥${expectedMin})`,
        parseInt(variantCount) >= expectedMin,
        `Only ${variantCount} variants for ${imageCount} images`
      )

      // Check size distribution
      const { rows: sizeDistRows } = await pgClient.query(
        `SELECT size, COUNT(*) as cnt FROM image_variant
         WHERE deleted_at IS NULL GROUP BY size ORDER BY size`
      )
      console.log("  Size distribution:")
      for (const row of sizeDistRows) {
        console.log(`    ${row.size}: ${row.cnt}`)
      }

      // Check no orphan variants (image_id references valid image)
      const { rows: [{ cnt: orphanVariants }] } = await pgClient.query(
        `SELECT COUNT(*) as cnt FROM image_variant iv
         WHERE iv.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM image i WHERE i.id = iv.image_id AND i.deleted_at IS NULL
         )`
      )
      check(
        `Orphan variants (no matching image): ${orphanVariants}`,
        parseInt(orphanVariants) === 0,
        `${orphanVariants} variant records reference non-existent images`
      )

      // Check all variants have URLs
      const { rows: [{ cnt: noUrlCount }] } = await pgClient.query(
        `SELECT COUNT(*) as cnt FROM image_variant
         WHERE deleted_at IS NULL AND (url IS NULL OR url = '')`
      )
      check(
        `Variants without URLs: ${noUrlCount}`,
        parseInt(noUrlCount) === 0,
        `${noUrlCount} variants missing URLs`
      )
    }

    console.log()

    // ───────────────────────────────────────────────────────────────────────
    // 5. Module tables have Medusa required columns
    // ───────────────────────────────────────────────────────────────────────
    console.log("── 5. Module Table Schema ──────────────────────────────────")

    for (const table of ["product_metadata", "image_variant"]) {
      const { rows: columns } = await pgClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table]
      )
      const colNames = columns.map((c: any) => c.column_name)
      const required = ["id", "created_at", "updated_at", "deleted_at"]
      const hasAll = required.every((r) => colNames.includes(r))
      check(
        `${table} has Medusa columns (id, created_at, updated_at, deleted_at)`,
        hasAll,
        `Missing: ${required.filter((r) => !colNames.includes(r)).join(", ")}`
      )
    }

    // Check link table exists and has expected columns
    const { rows: linkCols } = await pgClient.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [LINK_TABLE]
    )
    check(
      `Link table "${LINK_TABLE}" exists`,
      linkCols.length > 0,
      `Table not found`
    )
    if (linkCols.length > 0) {
      const colNames = linkCols.map((c: any) => c.column_name)
      check(
        `Link table has product_id column`,
        colNames.includes("product_id"),
        `Missing product_id`
      )
      check(
        `Link table has product_metadata_id column`,
        colNames.includes("product_metadata_id"),
        `Missing product_metadata_id`
      )
    }

    console.log()

    // ───────────────────────────────────────────────────────────────────────
    // Summary
    // ───────────────────────────────────────────────────────────────────────
    console.log("════════════════════════════════════════════════════════════════")
    console.log(`  PHASE 2 VERIFICATION: ${passed} passed, ${failed} failed`)
    console.log("════════════════════════════════════════════════════════════════")

    if (failures.length > 0) {
      console.log()
      console.log("  FAILURES:")
      for (const f of failures) {
        console.log(`    ❌ ${f}`)
      }
    }

    console.log()

    if (failed === 0) {
      console.log("✅ Phase 2 verification PASSED!")
    } else {
      console.log(`⚠️  Phase 2 verification: ${failed} check(s) failed`)
      process.exit(1)
    }

  } catch (err: any) {
    console.error("❌ Fatal error:", err.message)
    process.exit(1)
  } finally {
    if (pgClient) await pgClient.end()
  }
}

main()
