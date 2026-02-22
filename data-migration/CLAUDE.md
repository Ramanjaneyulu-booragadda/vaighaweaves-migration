# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Sequential TypeScript migration scripts that move VaighaWeaves e-commerce data from MySQL (Railway) to Medusa v2's PostgreSQL. Part of the larger VaighaWeaves migration from Express+React to Medusa.js+Next.js.

## Commands

```bash
# Install dependencies
npm install

# Run all 13 scripts sequentially (stops on first error)
npm run migrate:all

# Run individual scripts (must run in order, script:01 first)
npm run script:01    # Setup: creates migration_id_map table + custom tables
npm run script:02    # Categories (92 active, excludes soft-deleted)
npm run script:03    # Products
npm run script:04    # Images
npm run script:05    # Variants & Stock (consolidates triple-stock bug)
npm run script:06    # Users (handles guest customers)
npm run script:07    # Addresses
npm run script:08    # Orders (handles offline + guest)
npm run script:09    # Payments (Razorpay)
npm run script:10    # Stock Events (audit trail)
npm run script:11    # Shipments (multi-carrier)
npm run script:12    # Verification (data parity check)
npm run script:13    # Stock Reservations (phone bookings + walk-ins)
```

## Current Migration Status

Scripts 01-06 have been run successfully. Next: script:07 (addresses).

Source data volume (MySQL): 117 products, 105 categories (92 active), 2573 users, 864 orders, 1205 order items, 1311 product images, 863 payments.

Migration results so far:
- 92 categories migrated (5 root + 87 child, 13 soft-deleted excluded)
- 117 products migrated (110 published + 7 draft, all linked to categories)
- 1311 images migrated, 115 product thumbnails set
- 127 variants created (116 default + 11 sized), total stock 1336
- Full pricing chain (127 price_sets + 127 prices in INR) and inventory chain (127 inventory_items + 127 inventory_levels) created
- 2573 users migrated (2569 customers → `customer`, 4 admins → `user`)

## Architecture

### Script Pattern

Every script follows the same structure:
1. Connect to both MySQL (source) and PostgreSQL (target) using hardcoded configs with env var overrides
2. Read records from MySQL (filtering out soft-deleted rows via `deleted_at IS NULL`)
3. Generate deterministic UUIDs from old integer IDs using `generateUUIDFromId()` (SHA1-based UUID v5)
4. Insert into PostgreSQL with `ON CONFLICT DO NOTHING` (safe to re-run)
5. Save old->new ID mapping to `migration_id_map` table
6. Verify counts match

### Key Tables Created by Script 01

- **`migration_id_map`** - Core mapping table: `(old_table, old_id) -> (new_table, new_id TEXT)`. Every subsequent script reads from and writes to this table to resolve foreign key references.
- **`stock_event`** - Event-sourced stock ledger (append-only, tracks all inventory changes)
- **`stock_reservation`** - Phone bookings and walk-in reservations with expiry tracking

### ID Mapping System

Old MySQL integer IDs are converted to deterministic UUIDs via `generateUUIDFromId(tableName, oldId)`. The same input always produces the same UUID. This function is duplicated in each script file (not shared via import).

### Database Connections

Each script independently creates its own MySQL and PostgreSQL connections using configs at the top of the file. Connection params come from env vars with hardcoded Railway defaults as fallback. Both connections are closed in `finally` blocks.

### Script Dependencies

- Script 01 **must** run first (creates `migration_id_map` and custom tables)
- Scripts 02-07 have no interdependencies
- Scripts 08+ depend on earlier scripts for foreign key resolution via `migration_id_map`

## Critical Gotchas (Learned from Script 01/02 execution)

### Medusa v2 Uses TEXT IDs, Not UUID

All Medusa v2 tables (`product`, `customer`, `product_variant`, `product_category`, etc.) use `TEXT` for their `id` column, **not UUID**. Custom tables and `migration_id_map` must use `TEXT` for all ID and FK columns to avoid `incompatible types: uuid and text` errors.

### MySQL Column Names Are snake_case

The `mysql2` driver returns columns exactly as named in MySQL. The old database uses **snake_case** (`is_active`, `sort_order`, `parent_id`, `created_at`), NOT camelCase. TypeScript interfaces in each script must match MySQL column names exactly or values will be `undefined`.

### Medusa product_category Required Columns

`product_category` requires columns not obvious from the migration's original design:
- `description` (TEXT, NOT NULL, defaults to `''`)
- `mpath` (TEXT, NOT NULL, **no default**) - materialized path for hierarchy. Format: root = `{id}`, child = `{parent_mpath}.{id}`
- `is_internal` (BOOLEAN, NOT NULL, defaults to `false`)
- `handle` has a UNIQUE index (no duplicate slugs allowed)

### Soft Deletes

Most old MySQL tables use `deleted_at` for soft deletes. Migration queries should filter with `WHERE deleted_at IS NULL` to exclude archived records. **Exception:** `products` table has NO `deleted_at` column - migrate all rows.

### Medusa product Table

- `handle` has a UNIQUE index (maps from MySQL `slug`)
- `status` is TEXT: `'published'` or `'draft'` (maps from MySQL `is_active`)
- `weight` is TEXT, not decimal - use `String()` to cast
- `is_giftcard` and `discountable` are required booleans
- Product-to-category is a **many-to-many** via `product_category_product(product_id, product_category_id)` join table (not a direct FK on product)
- Custom fields (sku, brand, tags, compare_price, etc.) go in `metadata` JSONB

### Medusa image Table

- Table is called `image`, NOT `product_image`
- Has direct `product_id` FK (TEXT) - not a join table
- `url` (TEXT), `rank` (INT for sort order), `metadata` (JSONB)
- No unique index on url - duplicates allowed
- Set `product.thumbnail` to the primary image's URL after inserting images

### Medusa v2 Variant/Inventory/Pricing Chain

Every variant requires entries in 7 tables:
1. `product_variant` (title, sku, product_id) - `sku` has UNIQUE index
2. `price_set` (just an id container)
3. `product_variant_price_set` (variant_id, price_set_id) - uses `character varying`, not `text`
4. `price` (amount numeric, raw_amount JSONB `{"value":"999","precision":20}`, currency_code, price_set_id)
5. `inventory_item` (sku, title, requires_shipping)
6. `product_variant_inventory_item` (variant_id, inventory_item_id, required_quantity) - uses `character varying`, not `text`
7. `inventory_level` (inventory_item_id, location_id, stocked_quantity, reserved_quantity + raw_* JSONB fields)

For sized products, also need: `product_option` → `product_option_value` → `product_variant_option`

Stock location must exist before creating inventory_levels. Script 05 creates "VaighaWeaves Store" if missing.

### Medusa user vs customer Tables

- Customers → `customer` table (`has_account = true`, email has UNIQUE index on `(email, has_account)`)
- Admins → `user` table (reserved word - must quote as `"user"` in SQL, email UNIQUE index)
- Medusa setup pre-creates admin users - check for existing email before inserting to avoid unique constraint violations
- `users` table in MySQL has NO `deleted_at` column
- Password hashes are NOT migrated (Medusa has its own auth system)

## Critical Domain Knowledge

### Stock Consolidation (Script 05)

The old system has a **triple-level stock bug** where three different stock values go out of sync:
- `Product.stockQuantity` (total - unreliable)
- `ProductImage.stockQuantity` (per design - unreliable)
- `ProductImageSizeStock.stockQuantity` (per size - **source of truth**)

Only `ProductImageSizeStock` values are migrated to `ProductVariant.inventory_quantity`.

### Guest Customers (Scripts 06, 08)

Walk-in customers without accounts are created as: `email: "guest-{phoneHash}@vaighaweaves.local"` with `metadata.isGuestCustomer: true`.

### Environment Configuration

Copy `.env.example` to `.env`. Key vars:
- `OLD_DB_*` - MySQL source (Railway)
- `NEW_DB_*` - PostgreSQL target (local Medusa)
- `BATCH_SIZE` - Records per batch (default 100)
- `DRY_RUN` - Skip writes when true
- `VERBOSE` - Detailed per-record logging

## Writing New Migration Scripts

When creating scripts 03-13, follow this checklist:
1. Check the target Medusa table schema first: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '...'`
2. Check the source MySQL table schema: `DESCRIBE table_name` (columns are snake_case)
3. Use `TEXT` for all ID/FK columns (not UUID)
4. Filter soft-deleted rows: `WHERE deleted_at IS NULL`
5. Use `ON CONFLICT (id) DO NOTHING` for idempotent inserts
6. Declare connection variables as `let x: Type | null = null` to avoid TS strict mode errors
7. Check unique indexes on target table to avoid constraint violations

## Relationship to Parent Project

This is `migration/data-migration/` within the VaighaWeaves monorepo. The target PostgreSQL database is managed by `migration/vaighaweaves-medusa/` (Medusa.js backend). Medusa DB migrations (`npx medusa db:migrate`) must complete before running these scripts.
