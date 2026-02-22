# Data Migration Scripts: MySQL → Medusa PostgreSQL

This folder contains 13 sequential migration scripts to migrate your VaighaWeaves database from MySQL (Railway) to Medusa PostgreSQL.

---

## 📋 Prerequisites

### 1. **Install Dependencies**
```bash
cd migration/data-migration
npm install
```

### 2. **Set Environment Variables**

Copy `.env.example` to `.env` and update with your actual credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
# OLD DATABASE (MySQL via Railway)
OLD_DB_HOST=yamabiko.proxy.rlwy.net
OLD_DB_PORT=45132
OLD_DB_USER=root
OLD_DB_PASSWORD=dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf
OLD_DB_NAME=railway

# NEW DATABASE (PostgreSQL - Medusa)
NEW_DB_HOST=localhost
NEW_DB_PORT=5432
NEW_DB_USER=prudhvi
NEW_DB_PASSWORD=Oldisgold%402026
NEW_DB_NAME=vaighaweaves_db_dev

# MIGRATION OPTIONS (optional)
BATCH_SIZE=100
DRY_RUN=false
VERBOSE=true
```

### 3. **Verify Database Connectivity**

Test connection to both databases:
```bash
# MySQL (old system)
mysql -h yamabiko.proxy.rlwy.net -P 45132 -u root -p -e "SELECT COUNT(*) FROM products"

# PostgreSQL (new system)
psql -h localhost -U prudhvi -d vaighaweaves_db_dev -c "SELECT COUNT(*) FROM product_category"
```

---

## 🚀 Running the Migration

### Option A: Run All Scripts at Once (Recommended for First Time)

```bash
npm run migrate:all
```

This runs all 13 scripts sequentially and stops on first error.

### Option B: Run Scripts Individually

Run each script in order:

```bash
# Step 1: Setup & ID Mapping (MUST RUN FIRST)
npm run script:01

# Step 2: Categories (simple, no dependencies)
npm run script:02

# Step 3: Products
npm run script:03

# Step 4: Product Images
npm run script:04

# Step 5: Variants & Stock (MOST COMPLEX - consolidates triple-stock bug)
npm run script:05

# Step 6: Users (customers + admins)
npm run script:06

# Step 7: Addresses
npm run script:07

# Step 8: Orders (handles offline + guest customers)
npm run script:08

# Step 9: Payments (Razorpay)
npm run script:09

# Step 10: Stock Events (audit trail)
npm run script:10

# Step 11: Shipments (multi-carrier)
npm run script:11

# Step 12: Verification (100% data parity check)
npm run script:12

# Step 13: Stock Reservations (phone bookings + walk-ins)
npm run script:13
```

---

## 📊 Expected Output

Each script shows:
- ✅ Connected to both databases
- 📥 Count of records read from MySQL
- 💾 Count of records inserted into PostgreSQL
- 🔍 Verification stats
- ✅ Completion confirmation

### Example Output (Script 01 - actual):

```
================================================================================
SCRIPT 01: Setup Medusa Schema & ID Mapping
================================================================================

🔗 Establishing database connections...
✅ Connected to OLD MySQL database (Railway)
✅ Connected to NEW PostgreSQL database (Medusa)

🔍 Verifying database contents...
✅ MySQL has 54 tables
   - Products: 117
   - Categories: 105
   - Users: 2573
   - Orders: 864
✅ PostgreSQL has 134 tables

📋 Creating migration_id_map table...
✅ migration_id_map table created successfully

📋 Creating custom tables for VaighaWeaves features...
✅ Custom tables created successfully

📊 Data Volume Summary:
   products                       : 117 rows
   categories                     : 105 rows
   product_images                 : 1311 rows
   users                          : 2573 rows
   orders                         : 864 rows
   order_items                    : 1205 rows
   stock_events                   : 36 rows
   payments                       : 863 rows
   shipments                      : 0 rows

================================================================================
✅ SETUP COMPLETE - Ready for data migration!
================================================================================
```

---

## ⚠️ Important Notes

### 1. **Run Scripts in Order**
- Script 01 **MUST** run first (creates ID mapping table)
- Scripts 02-07 have no interdependencies (can run in any order)
- Scripts 08+ depend on earlier scripts (must follow order)

### 2. **Stock Consolidation (Script 05)**
This script consolidates the **triple-level stock bug**:

```
OLD (3 levels):
  Product.stockQuantity = 100
  ProductImage.stockQuantity = 25
  ProductImageSizeStock.stockQuantity = 5  ← USED (conflicts!)

NEW (1 level - FIXED):
  ProductVariant.inventory_quantity = 5  ← Single source of truth!
```

**Key Point:** Only `ProductImageSizeStock` values are used. Product-level and Image-level stocks are ignored (they were derived/buggy values).

### 3. **Guest Customers (Script 06 & 08)**
Walk-in customers without accounts are created with:
```
email: "guest-{phoneHash}@vaighaweaves.local"
name: Customer name from order
phone: Customer phone from order
metadata.isGuestCustomer: true
```

### 4. **Offline Orders (Script 08)**
Orders with `isOfflinePayment = true` preserve:
- Payment reference (cash receipt, card terminal)
- Admin who processed the order
- Customer details (name, phone for walk-ins)

### 5. **Stock Reservations (Script 13)**
Phone reservations are preserved with:
- Expiry duration (15min, 30min, 1hr, 4hr, 24hr)
- Customer name & phone (for walk-ins)
- Auto-expiry tracking

---

## 🔍 Monitoring Progress

### View Current Migration Status

```bash
# Count records in PostgreSQL
psql -h localhost -U prudhvi -d vaighaweaves_db_dev

# In psql:
SELECT COUNT(*) FROM product_category;        -- Categories
SELECT COUNT(*) FROM product;                 -- Products
SELECT COUNT(*) FROM product_variant;         -- Variants
SELECT COUNT(*) FROM customer;                -- Customers
SELECT COUNT(*) FROM "order";                 -- Orders
SELECT COUNT(*) FROM order_line_item;         -- Order items
```

### Check ID Mappings

```bash
# See how many IDs have been mapped
SELECT old_table, COUNT(*) as count
FROM migration_id_map
GROUP BY old_table
ORDER BY old_table;
```

---

## ❌ Troubleshooting

### Error: "Connection refused"
```
Fix: Check DATABASE_URL in .env file
- Verify MySQL is accessible from your computer
- Verify PostgreSQL is running locally
- Check firewall settings
```

### Error: "Table does not exist"
```
Fix: Make sure Script 01 ran successfully
- Script 01 must run first to create tables
- Check that Medusa migrations are complete:
  cd ../vaighaweaves-medusa
  npx medusa db:migrate
```

### Error: "Foreign key constraint failed"
```
Fix: Check script order
- Scripts must run in the specified order
- Parent records must be migrated before child records
- Example: Categories before Products before OrderItems
```

### Error: "Duplicate key value"
```
Fix: Check if migration already ran
- Some rows may already exist in target database
- Scripts use ON CONFLICT to skip duplicates
- Safe to re-run without losing data
```

### Error: "Key columns are of incompatible types: uuid and text"
```
Fix: Medusa v2 uses TEXT for all ID columns, not UUID.
- Custom tables must use TEXT for all ID/FK columns
- The migration_id_map.new_id column must be TEXT
- If you hit this, drop the affected table and re-run Script 01:
  psql -d vaighaweaves_db_dev -c "DROP TABLE IF EXISTS migration_id_map CASCADE;"
  npm run script:01
```

### Error: "null value in column violates not-null constraint"
```
Fix: MySQL column names use snake_case (is_active, sort_order, parent_id).
- The mysql2 driver returns columns as-is from the database
- TypeScript interfaces must match MySQL column names exactly
- Check DESCRIBE table_name in MySQL to see actual column names
```

---

## 🎯 Success Criteria

After all scripts complete, verify:

### 1. Row Counts Match
```bash
# Old system
SELECT COUNT(*) FROM products;        -- e.g., 487
SELECT COUNT(*) FROM orders;          -- e.g., 1,245

# New system
SELECT COUNT(*) FROM product;         -- Should be 487
SELECT COUNT(*) FROM "order";         -- Should be 1,245
```

### 2. Stock Totals Match
```bash
# Old system
SELECT SUM(stock_quantity) FROM product_image_size_stock;  -- e.g., 5,234

# New system
SELECT SUM(inventory_quantity) FROM product_variant;      -- Should be 5,234
```

### 3. Revenue Matches
```bash
# Old system
SELECT SUM(total) FROM orders;         -- e.g., 1,234,567.89

# New system
SELECT SUM(total) FROM "order";        -- Should match exactly
```

### 4. No Data Loss
- All ID mappings recorded in `migration_id_map`
- All products linked to categories
- All orders linked to customers
- All order items linked to variants

---

## 📝 Migration Log

After running migrations, check the logs:
```bash
# View script output (saved to console)
# For more detailed logging, set VERBOSE=true in .env
```

---

## 🚨 Rollback Plan

If something goes wrong:

```bash
# Stop the migration (Ctrl+C)

# Drop the new database (use with caution!)
dropdb vaighaweaves_db_dev

# Recreate it
createdb vaighaweaves_db_dev

# Re-run Medusa migrations
cd ../vaighaweaves-medusa
npx medusa db:migrate

# Start migration again
cd ../data-migration
npm run migrate:all
```

---

## 📞 Need Help?

Check the migration strategy document:
```bash
cat ../MIGRATION_STRATEGY.md
cat ../OFFLINE_ORDERS_PLAN.md
```

---

## 🔧 Fixes Applied During Migration

These are the code fixes made to the original scripts to get them running. Documented for future reference when writing scripts 03-13.

### Script 01 Fixes

**1. Install missing type declarations**
```bash
npm install --save-dev @types/pg
```

**2. Change `migration_id_map.new_id` from UUID to TEXT**
Medusa v2 uses `TEXT` for all ID columns. Original script used `UUID` which caused FK constraint errors.
```diff
- new_id UUID NOT NULL,
+ new_id TEXT NOT NULL,
```

**3. Change custom table columns from UUID to TEXT**
Both `stock_reservation` and `stock_event` tables had `UUID` types for all ID/FK columns (`id`, `staff_id`, `customer_id`, `product_id`, `variant_id`, `order_id`, `created_by`). All changed to `TEXT` with `gen_random_uuid()::text` for defaults.
```diff
- id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
- customer_id UUID,
+ id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
+ customer_id TEXT,
```

**4. Fix TypeScript strict mode error for uninitialized variables**
```diff
- let mysqlConnection: any
- let pgClient: PgClient
+ let mysqlConnection: any = null
+ let pgClient: PgClient | null = null
```
Also added `!` non-null assertions where `pgClient` is used after assignment inside the try block.

### Script 02 Fixes

**1. Fix OldCategory interface to match MySQL snake_case column names**
The `mysql2` driver returns columns exactly as named in MySQL. The original interface used camelCase which resulted in `undefined` values.
```diff
- interface OldCategory {
-   id: number
-   name: string
-   slug: string
-   parentId: number | null
-   isActive: boolean
-   sortOrder: number
-   createdAt: Date
-   updatedAt: Date
- }
+ interface OldCategory {
+   id: number
+   name: string
+   slug: string
+   description: string | null
+   parent_id: number | null
+   is_active: number  // tinyint(1) in MySQL
+   sort_order: number
+   created_at: Date
+   updated_at: Date
+   deleted_at: Date | null
+ }
```

**2. Add missing Medusa required columns to INSERT**
`product_category` requires `description`, `mpath`, and `is_internal` (all NOT NULL). Original INSERT only had 7 columns.
```diff
- INSERT INTO product_category (
-   id, name, handle, parent_category_id, is_active, rank, metadata
- ) VALUES ($1, $2, $3, $4, $5, $6, $7)
+ INSERT INTO product_category (
+   id, name, description, handle, mpath, parent_category_id,
+   is_active, is_internal, rank, metadata
+ ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
```

**3. Compute `mpath` (materialized path) for category hierarchy**
Added two-pass logic: roots get `mpath = id`, children get `mpath = parent_mpath.id`. Uses iterative resolution for multi-level nesting.

**4. Filter soft-deleted categories**
```diff
- SELECT * FROM categories ORDER BY id ASC
+ SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY id ASC
```
This reduced categories from 105 to 92 (13 soft-deleted excluded).

**5. Fix TypeScript strict mode (same as Script 01)**
```diff
- let pgClient: PgClient
+ let pgClient: PgClient | null = null
```

**6. Cast `is_active` from MySQL tinyint to boolean**
```diff
- is_active: oldCat.isActive,
+ is_active: Boolean(oldCat.is_active),
```

### Script 03 Notes (no fixes needed - written with lessons from 01/02)

Script 03 was written from scratch using the lessons learned. Key design decisions:
- MySQL `products` table has **no `deleted_at` column** - all 117 rows migrated
- `is_active` mapped to Medusa `status`: `1` → `'published'`, `0` → `'draft'`
- Product-to-category linked via `product_category_product` join table (Medusa uses a many-to-many join table, not a direct FK)
- Category mappings loaded from `migration_id_map` at the start (not generated inline)
- Custom fields (`sku`, `brand`, `tags`, `is_featured`, `compare_price`, `cost_price`, etc.) stored in `metadata` JSONB
- `origin_country` set to `'IN'` (India)
- Medusa `product.weight` is `TEXT` not decimal - cast with `String()`
- Verifies script:02 ran by checking category count before starting

### Script 04 Notes (no fixes needed)

- Medusa image table is called `image` (not `product_image`) with direct `product_id` FK
- All 1311 images were ACTIVE with no soft-deleted rows (no filtering needed beyond `status = 'ACTIVE' AND deleted_at IS NULL`)
- Primary images (`is_primary = 1`) used to set `product.thumbnail` URL - 115 of 117 products got thumbnails (2 had no primary image)
- Custom fields (`design_name`, `sku`, `stock_quantity`, `alt_text`, etc.) stored in `metadata` JSONB
- Progress logged every 100 images (batch feedback for 1311 rows)

### Script 05 Notes (no fixes needed - most complex script)

Key findings during schema analysis:
- **`product_variants` table in MySQL is EMPTY** (0 rows) - never used in production
- **`product_image_size_stocks` has only 11 rows** - all for product 86 (Readymade)
- 116 of 117 products have NO size-level stock - only product-level `stock_quantity`

Medusa v2 variant/inventory/pricing chain (7 tables per variant):
1. `product_variant` → variant itself (title, sku, product_id)
2. `price_set` → container for prices
3. `product_variant_price_set` → links variant to price_set (columns are `character varying`, not `text`)
4. `price` → actual amount (amount numeric, raw_amount JSONB `{"value":"999","precision":20}`, currency_code)
5. `inventory_item` → inventoried item (sku, title)
6. `product_variant_inventory_item` → links variant to inventory_item (columns are `character varying`, not `text`)
7. `inventory_level` → stock at location (stocked_quantity, reserved_quantity, raw_* JSONB fields)

Additional tables for sized products only:
- `product_option` → "Size" option for the product
- `product_option_value` → "S", "M", "L", etc.
- `product_variant_option` → links variant to its option value

Other notes:
- `stock_location` was empty - script creates "VaighaWeaves Store" location automatically
- `inventory_level` has a unique index on `(inventory_item_id, location_id)`
- `product_variant.sku` has a unique index (soft-delete aware)

---

### Script 06 Fixes

**1. Admin user email already exists in Medusa `user` table**
Medusa setup creates an admin user. The `user` table has a UNIQUE index on `email` (soft-delete aware). `ON CONFLICT (id) DO NOTHING` doesn't catch email uniqueness violations since the existing row has a different id.

Fix: Check for existing email before inserting. If found, map old user to the existing Medusa user id instead of generating a new one.
```typescript
const existing = await pgClient.query(
  `SELECT id FROM "user" WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
  [user.email]
)
if (existing.rows.length > 0) {
  mappedId = existing.rows[0].id // map to existing
} else {
  // insert new
}
```

Other notes:
- `users` table has NO `deleted_at` column - all 2573 rows migrated
- Customers (role != 'administrator') → `customer` table with `has_account = true`
- Admins (role = 'administrator') → `user` table (note: quoted as `"user"` in SQL - reserved word)
- Password hashes NOT migrated (users use Medusa auth system or reset)
- `customer.email` has UNIQUE index on `(email, has_account)` - different from `user.email` uniqueness
- 8 users with null `first_name` → coalesced to empty string

---

## ✅ Migration Progress

| Script | Status | Records | Notes |
|--------|--------|---------|-------|
| 01 - Setup Schema | ✅ Done | N/A | `migration_id_map`, `stock_event`, `stock_reservation` tables created |
| 02 - Categories | ✅ Done | 92/92 | 5 root + 87 child categories, 13 soft-deleted excluded |
| 03 - Products | ✅ Done | 117/117 | 110 published + 7 draft, all linked to categories |
| 04 - Images | ✅ Done | 1311/1311 | 115 thumbnails set, avg 11 images/product |
| 05 - Variants & Stock | ✅ Done | 127 variants | 116 default + 11 sized (product 86), total stock 1336 |
| 06 - Users | ✅ Done | 2573/2573 | 2569 customers + 4 admins, 2 admins mapped to existing |
| 07 - Addresses | ⬜ Pending | — | |
| 08 - Orders | ⬜ Pending | — | |
| 09 - Payments | ⬜ Pending | — | |
| 10 - Stock Events | ⬜ Pending | — | |
| 11 - Shipments | ⬜ Pending | — | |
| 12 - Verification | ⬜ Pending | — | |
| 13 - Stock Reservations | ⬜ Pending | — | |

**Source Data Volume (MySQL):**
- Products: 117 | Categories: 105 (92 active) | Users: 2,573
- Orders: 864 | Order Items: 1,205 | Payments: 863
- Product Images: 1,311 | Stock Events: 36 | Shipments: 0

**Last Run:** February 18, 2026
**Next Step:** Run `npm run script:07` (migrate addresses)
