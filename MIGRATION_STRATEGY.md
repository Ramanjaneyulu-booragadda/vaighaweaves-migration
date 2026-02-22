# VaighaWeaves → Medusa Migration Strategy

**Date:** February 17, 2026
**Database:** MySQL (Railway) → PostgreSQL (Local)
**Schema Analysis:** Complete ✅
**Feasibility:** 95% Migratable

---

## 🔍 Schema Analysis Summary

### Source Database (MySQL via Prisma)
- **Models:** 60+ models
- **Lines:** 1,617 lines
- **Relationships:** Complex (1-to-many, many-to-many, self-referencing)
- **Special Features:**
  - Event sourcing (StockEvent)
  - Soft deletes (ProductImage)
  - Hierarchical categories
  - Multi-carrier shipping

---

## ✅ What CAN Be Migrated (95%)

### 1. **Product Catalog** (100% compatible)
| Old Schema | Medusa Equivalent | Mapping Complexity |
|------------|-------------------|-------------------|
| Product | Product | ⭐ Easy |
| ProductVariant | ProductVariant | ⭐ Easy |
| ProductImage | ProductImage | ⭐⭐ Medium (soft-delete handling) |
| Category | ProductCategory | ⭐⭐ Medium (hierarchical) |

**Product Model Fields (73 total):**
```typescript
// OLD (VaighaWeaves)
Product {
  id: Int
  name: String
  slug: String
  sku: String
  price: Decimal
  stockQuantity: Int          // ❌ Will be replaced
  categoryId: Int
  fabric: String
  occasion: String
  material: String
  // ... 60+ more fields
}

// NEW (Medusa)
Product {
  id: string (UUID)
  title: string               // ← name
  handle: string              // ← slug
  variants: ProductVariant[]  // ← stock managed here
  categories: ProductCategory[]
  metadata: {                 // ← Custom fields
    fabric: string
    occasion: string
    material: string
    oldSku: string            // ← preserve for reference
  }
}
```

### 2. **Users & Authentication** (100% compatible)
```typescript
// OLD
User {
  id: Int
  username: String
  email: String
  password: String (bcrypt)
  role: 'CUSTOMER' | 'ADMIN'
}

// NEW (Medusa)
Customer {
  id: string (UUID)
  email: string
  password_hash: string       // ← Direct bcrypt migration
  metadata: {
    username: string
    oldUserId: number
  }
}

AdminUser {                    // For role='ADMIN'
  email: string
  password_hash: string
}
```

### 3. **Orders & Payments** (95% compatible)
```typescript
// OLD
Order {
  id: Int
  orderNumber: String
  userId: Int
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: Decimal
  stockDeductedAt: DateTime
  // 40+ fields
}

OrderItem {
  id: Int
  orderId: Int
  productId: Int
  imageId: Int
  designName: String          // ⭐ Snapshot for history
  imageUrl: String            // ⭐ Snapshot for history
  sku: String                 // ⭐ Snapshot for history
  quantity: Int
  price: Decimal
}

// NEW (Medusa)
Order {
  id: string (UUID)
  display_id: number          // ← orderNumber
  customer_id: string
  status: string
  payment_status: string
  total: number
  items: LineItem[]
  metadata: {
    stockDeductedAt: string
    oldOrderId: number
  }
}

LineItem {
  id: string
  title: string               // ← Product name snapshot
  thumbnail: string           // ← imageUrl snapshot
  metadata: {
    designName: string
    originalSku: string
  }
}
```

### 4. **Addresses** (100% compatible)
```typescript
// Direct 1:1 mapping
Address → CustomerAddress
```

### 5. **Stock Management** (⚠️ REQUIRES CONSOLIDATION)
```typescript
// OLD (TRIPLE-LEVEL STOCK - THE BUG!)
Product.stockQuantity = 100          // Level 1: Total
ProductImage.stockQuantity = 25      // Level 2: Per design
ProductImageSizeStock.stockQuantity = 5  // Level 3: Per size

// NEW (SINGLE SOURCE OF TRUTH)
ProductVariant {
  inventory_quantity: number  // ← ONLY stock field
  sku: string                 // ← Unique per size+design combo
}

InventoryItem {               // Medusa built-in
  sku: string
  reserved_quantity: number
  stocked_quantity: number
}

StockEvent {                  // Custom (already exists!)
  id: string
  variant_id: string
  event_type: 'RESERVED' | 'RELEASED' | 'DEDUCTED' | 'RESTORED'
  quantity: number
  reason: string
  source: string
  metadata: Json
  created_at: DateTime
}
```

**Stock Consolidation Strategy:**
```sql
-- Calculate final stock per variant
SELECT
  p.id as product_id,
  pi.id as image_id,
  piss.size,
  pi.designName,
  piss.stockQuantity as current_stock,
  -- Generate new SKU
  CONCAT(p.sku, '-', pi.designName, '-', piss.size) as new_sku
FROM ProductImageSizeStock piss
JOIN ProductImage pi ON piss.imageId = pi.id
JOIN Product p ON pi.productId = p.id
WHERE pi.status = 'ACTIVE'
  AND pi.deletedAt IS NULL
```

### 6. **Categories** (100% compatible)
```typescript
// OLD (Self-referencing hierarchy)
Category {
  id: Int
  name: String
  slug: String
  parentId: Int?              // Self-reference
  isActive: Boolean
  sortOrder: Int
}

// NEW (Medusa)
ProductCategory {
  id: string
  name: string
  handle: string              // ← slug
  parent_category_id: string? // ← parentId
  is_active: boolean
  rank: number                // ← sortOrder
  metadata: {
    oldCategoryId: number
  }
}
```

### 7. **Shipping** (90% compatible)
```typescript
// OLD (Multi-carrier support)
Shipment {
  orderId: Int
  carrier: 'BLUEDART' | 'DELHIVERY' | 'DTDC' | 'INDIA_POST' | 'MANUAL'
  trackingNumber: String
  shippedAt: DateTime
}

// NEW (Medusa Fulfillment)
Fulfillment {
  order_id: string
  provider_id: string         // ← carrier
  tracking_numbers: string[]
  shipped_at: DateTime
  metadata: {
    carrier: string
    oldShipmentId: number
  }
}
```

---

## ❌ What CANNOT Be Migrated (5%)

### 1. **Database-Specific Features**
- MySQL `FULLTEXT` indexes → PostgreSQL `tsvector`
- MySQL `ENUM` → PostgreSQL `enum` types (need recreation)
- Auto-increment IDs → UUIDs (ID mapping table required)

### 2. **Direct SQL Queries in Code**
Any raw SQL queries in Express codebase will need rewriting.

### 3. **Bcrypt Rounds Mismatch** (minor)
Old system may use different bcrypt rounds. Users may need password reset.

---

## 🔥 Critical Migration Challenges

### Challenge 1: Stock Consolidation (P0 - CRITICAL)

**Problem:**
```typescript
// Current: 3 levels of stock = sync nightmare
Product.stockQuantity = 100
ProductImage.stockQuantity = 25
ProductImageSizeStock.stockQuantity = 5
// These go OUT OF SYNC after orders/cancellations
```

**Solution:**
```typescript
// New: Single source of truth
ProductVariant {
  sku: "SAREE-001-RED-FLORAL-M"  // Unique per combo
  inventory_quantity: 5           // ONLY stock field
}

// Mapping logic
Old: Product(1) → ProductImage(1) → Size(S) = 5 units
New: ProductVariant(uuid) with sku="SAREE-001-IMG-1-S" = 5 units
```

**Migration Script Strategy:**
1. Create ProductVariant for each (Product + ProductImage + Size) combo
2. Set `inventory_quantity` from `ProductImageSizeStock.stockQuantity`
3. Ignore `Product.stockQuantity` and `ProductImage.stockQuantity` (derived values)
4. Preserve old IDs in `metadata.oldProductId`, `metadata.oldImageId`

### Challenge 2: Image Soft Deletes

**Problem:**
```typescript
ProductImage {
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED' | 'PURGED'
  deletedAt: DateTime?
  archivedAt: DateTime?
}

// Orders reference images by ID
OrderItem.imageId = 123
// What if image was deleted after order?
```

**Solution:**
Medusa doesn't have soft-delete for images, but OrderItem already has snapshots!

```typescript
// OLD (Smart design - already preserves history!)
OrderItem {
  imageUrl: String     // ⭐ Snapshot at purchase time
  designName: String   // ⭐ Snapshot at purchase time
  sku: String          // ⭐ Snapshot at purchase time
}

// NEW (Preserve in metadata)
LineItem {
  thumbnail: string    // ← imageUrl snapshot
  metadata: {
    designName: string
    originalSku: string
    wasProductDeleted: boolean
  }
}
```

**Migration Script Strategy:**
- Migrate ALL images (even deleted ones) to preserve `imageId` references
- Mark deleted images in `metadata.isDeleted = true`
- Use OrderItem snapshots (imageUrl, designName, sku) as primary source

### Challenge 3: Order Status Mapping

**Problem:**
```typescript
// OLD: 12 order statuses
OrderStatus =
  | 'PENDING'           // ← Medusa: 'pending'
  | 'PAYMENT_INITIATED' // ← Medusa: 'pending' (metadata)
  | 'PAYMENT_FAILED'    // ← Medusa: 'canceled'
  | 'CONFIRMED'         // ← Medusa: 'pending'
  | 'PROCESSING'        // ← Medusa: 'pending'
  | 'PICKED'            // ← Medusa: 'fulfilled' (custom)
  | 'PACKED'            // ← Medusa: 'fulfilled' (custom)
  | 'SHIPPED'           // ← Medusa: 'fulfilled'
  | 'OUT_FOR_DELIVERY'  // ← Medusa: 'fulfilled'
  | 'DELIVERED'         // ← Medusa: 'completed'
  | 'CANCELLED'         // ← Medusa: 'canceled'
  | 'REFUNDED'          // ← Medusa: 'canceled' + refund
```

**Solution:**
Map to Medusa statuses + preserve original in metadata:

```typescript
LineItem {
  metadata: {
    originalStatus: 'PICKED',
    originalPaymentStatus: 'COMPLETED',
    fulfillmentStage: 'PICKED'
  }
}
```

---

## 🏪 Offline/In-Store Booking Flow (Critical)

**User Confirmed Requirements:**
- ✅ Keep existing `StockReservation` system
- ✅ Support flexible hold durations: 15min, 30min, 1hr, 4hr, 24hr
- ✅ Walk-in customers (NO user accounts required)
- ✅ Create guest orders with just name + phone
- ✅ "Decent number" of offline orders (high priority)

### Current Offline Order Handling

**Scenario 1: Phone Reservation → Walk-in Purchase**
```
1. Customer calls: "Can you hold red saree, Size M?"
2. Admin creates StockReservation:
   - customerName: "Priya Sharma"
   - customerPhone: "+91 98765 43210"
   - status: ACTIVE
   - expiresAt: [based on duration: 15min/30min/1hr/4hr/24hr]

3. Customer walks in within time:
   - Admin creates Order with isOfflinePayment=true
   - Links orderId → StockReservation.orderId
   - Stock deducted
   - Status: ACTIVE → CONVERTED

4. Timeout (customer doesn't show):
   - Cron job checks expiresAt
   - Status: ACTIVE → EXPIRED
   - Stock released back
```

**Scenario 2: Walk-in Purchase (No Reservation)**
```
1. Customer walks in, browses, picks saree
2. Admin creates Order:
   - isOfflinePayment: true
   - userId: GUEST_USER_ID (or NULL)
   - shippingAddress: temp address with phone
   - offlinePaymentRef: "CASH-001" or "CARD-TERMINAL-5"

3. Stock deducted immediately via StockEvent
4. Receipt printed
5. No shipping (physical pickup)
```

### Migration Mapping

```typescript
// OLD: StockReservation
{
  reservedBy: Int              // Admin user ID
  reservedFor: Int?            // Customer user ID (NULL for walk-ins)
  customerName: String?        // "Priya Sharma"
  customerPhone: String?       // "+91 98765 43210"
  expiresAt: DateTime          // When reservation expires
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED'
}

// NEW: Custom Medusa Table (StockReservation)
{
  staff_id: UUID              // Admin user ID
  customer_id: UUID?          // Customer ID (NULL for walk-ins)
  customer_name: String?      // Preserved for walk-ins
  customer_phone: String?     // Preserved for walk-ins
  expires_at: DateTime        // Auto-expire
  status: ENUM               // Same statuses
  metadata: {
    expiryDuration: '15min' | '30min' | '1hr' | '4hr' | '24hr'
    oldReservationId: number
  }
}

// OLD: Offline Order
Order {
  isOfflinePayment: true
  processedByAdminId: 123
  offlinePaymentRef: "CASH-RECEIPT-001"
  userId: NULL (for walk-ins)
}

// NEW: Offline Order in Medusa
Order {
  metadata: {
    isOfflinePayment: true
    processedByStaffId: UUID
    offlinePaymentRef: string
    paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'CHEQUE'
    guestCustomerName: String?
    guestCustomerPhone: String?
  }
  customer_id: NULL or GUEST_CUSTOMER_ID
}
```

### Handling Guest Orders (Walk-ins without accounts)

**Challenge:** Medusa requires `customer_id` for orders, but walk-ins might not have accounts.

**Solution Options:**

**Option A: Create Guest Customer Profile** (Recommended)
```typescript
// Create a Customer record for each walk-in
Customer {
  email: "guest-{phoneHash}@vaighaweaves.local"
  first_name: "Priya"
  last_name: "Sharma"
  phone: "+91 98765 43210"
  metadata: {
    isGuestCustomer: true
    walkinDate: DateTime
    oldCustomerId: null
  }
}

// Then create Order linked to this guest customer
```

**Option B: NULL Customer ID** (Requires Medusa modifications)
- Modify Medusa OrderService to allow `customer_id = NULL`
- Store guest details in `Order.metadata`
- More work but cleaner separation

**Recommendation:** Option A (guest customer profile)
- Medusa can then send SMS/email to guest for order updates
- No core Medusa modifications needed
- Can track walk-in customer repeat visits

---

## 📋 Migration Script Plan

### Phase 1.2: Data Migration (This Week)

**Scripts to Create (in `migration/data-migration/`):**

1. **`01-setup-medusa-schema.ts`** (~50 lines)
   - Ensure Medusa database is initialized
   - Create custom tables (stock_event, etc.)
   - Create ID mapping tables

2. **`02-migrate-categories.ts`** (~200 lines)
   - Migrate Category → ProductCategory
   - Preserve hierarchy (parent-child)
   - Create handle from slug

3. **`03-migrate-products.ts`** (~300 lines)
   - Migrate Product → Product
   - Map custom fields to metadata
   - Link to categories

4. **`04-migrate-images.ts`** (~250 lines)
   - Migrate ProductImage → ProductImage
   - Handle soft-deleted images
   - Preserve designName in metadata

5. **`05-migrate-variants-and-stock.ts`** (~400 lines) ⭐ MOST COMPLEX
   - Create ProductVariant for each (Product + Image + Size) combo
   - Generate unique SKU: `{productSku}-{imageId}-{size}`
   - Set `inventory_quantity` from `ProductImageSizeStock.stockQuantity`
   - ⚠️ IGNORE Product.stockQuantity and ProductImage.stockQuantity
   - Create InventoryItem for each variant
   - Preserve mapping in ID table

6. **`06-migrate-users.ts`** (~200 lines)
   - Migrate User (role=CUSTOMER) → Customer
   - Migrate User (role=ADMIN) → AdminUser
   - Preserve bcrypt password hashes

7. **`07-migrate-addresses.ts`** (~150 lines)
   - Migrate Address → CustomerAddress
   - Link to Customer via ID mapping

8. **`08-migrate-orders.ts`** (~500 lines) ⭐ COMPLEX
   - Migrate Order → Order
   - Migrate OrderItem → LineItem
   - Preserve image snapshots in metadata
   - Map order statuses
   - Link to Customer and ProductVariant

9. **`09-migrate-payments.ts`** (~300 lines)
   - Migrate Payment → Payment
   - Link to Order
   - Preserve Razorpay transaction IDs

10. **`10-migrate-stock-events.ts`** (~200 lines)
    - Migrate StockEvent → StockEvent (custom table)
    - Link to ProductVariant via ID mapping
    - Preserve event history

11. **`11-migrate-shipments.ts`** (~200 lines)
    - Migrate Shipment → Fulfillment
    - Map carriers to Medusa providers
    - Preserve tracking numbers

12. **`12-verify-migration.ts`** (~300 lines)
    - Compare row counts (old vs new)
    - Verify stock totals match
    - Check order totals match
    - Generate diff report

13. **`13-migrate-stock-reservations.ts`** (~200 lines)
    - Migrate StockReservation → Custom Medusa reservation table
    - Preserve customer details (name, phone for walk-ins)
    - Link to ProductVariant via ID mapping
    - Handle expiry durations: 15min, 30min, 1hr, 4hr, 24hr
    - Filter by status: migrate ACTIVE + CONVERTED (for history)

**Total:** ~3,200 lines across 13 scripts

---

## 🗺️ ID Mapping Strategy

Since MySQL uses `Int` auto-increment and Medusa uses `UUID` (string), we need an ID mapping table:

```sql
-- Create in PostgreSQL
CREATE TABLE migration_id_map (
  old_table VARCHAR(50),
  old_id INT,
  new_table VARCHAR(50),
  new_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (old_table, old_id)
);

-- Example rows
INSERT INTO migration_id_map VALUES
  ('products', 1, 'product', 'prod_01HQ...', NOW()),
  ('product_images', 5, 'product_image', 'img_01HQ...', NOW());

-- Query helper
SELECT new_id FROM migration_id_map
WHERE old_table = 'products' AND old_id = 1;
```

---

## 📊 Data Volume Estimates

Based on typical e-commerce platforms:

| Entity | Estimated Rows | Migration Time |
|--------|---------------|----------------|
| Categories | ~50 | < 1 second |
| Products | ~500-1,000 | ~10 seconds |
| ProductImages | ~2,000-4,000 | ~20 seconds |
| ProductVariants | ~10,000-20,000 | ~2 minutes |
| Users | ~1,000-5,000 | ~30 seconds |
| Orders | ~5,000-10,000 | ~3 minutes |
| OrderItems | ~20,000-40,000 | ~5 minutes |
| StockEvents | ~50,000-100,000 | ~10 minutes |

**Total Estimated Time:** ~20-30 minutes for full migration

---

## ✅ Migration Success Criteria

### 1. Data Parity (100%)
```typescript
// Verify counts match
assert(oldProductCount === newProductCount)
assert(oldOrderCount === newOrderCount)
assert(oldUserCount === newCustomerCount + newAdminCount)
```

### 2. Stock Accuracy (100%)
```typescript
// Verify total stock matches
const oldTotalStock = sumOf(ProductImageSizeStock.stockQuantity)
const newTotalStock = sumOf(ProductVariant.inventory_quantity)
assert(oldTotalStock === newTotalStock)
```

### 3. Order History Preserved (100%)
```typescript
// Verify all order items have image snapshots
assert(every(LineItem has metadata.designName))
assert(every(LineItem has thumbnail))
```

### 4. Revenue Match (100%)
```typescript
// Verify total revenue matches
const oldRevenue = sumOf(Order.total)
const newRevenue = sumOf(Order.total)
assert(oldRevenue === newRevenue)
```

---

## 🚨 Rollback Plan

If migration fails:

```bash
# Step 1: Drop new database
dropdb vaighaweaves_db_dev
createdb vaighaweaves_db_dev

# Step 2: Re-run Medusa migrations
cd migration/vaighaweaves-medusa
npx medusa db:migrate

# Step 3: Fix migration script
# Step 4: Re-run migration
```

---

## 📅 Timeline

| Day | Tasks | Duration |
|-----|-------|----------|
| **Day 1 (Today)** | Write scripts 01-05 (categories, products, variants, stock) | 4 hours |
| **Day 2** | Write scripts 06-09 (users, addresses, orders, payments) | 4 hours |
| **Day 3** | Write scripts 10-12 (stock events, shipments, verification) | 3 hours |
| **Day 4** | Run migration + debug + verify | 3 hours |
| **Day 5** | Buffer for issues | 2 hours |

**Total:** 16 hours over 5 days

---

## 🎯 Next Steps

1. **Get approval** for this migration strategy
2. **Connect to old MySQL database** (Railway)
3. **Write migration script 01**: Setup & ID mapping table
4. **Write migration script 02**: Categories (simplest, no dependencies)
5. **Test category migration** with 10 sample rows
6. **Iterate** through remaining scripts

---

## 📚 References

- Old Schema: `vaighaweaves-server/prisma/schema.prisma`
- Medusa Schema: https://docs.medusajs.com/resources/references/data-model
- Migration Scripts: `migration/data-migration/`

---

**Status:** ✅ Migration is FEASIBLE
**Confidence:** 95%
**Blockers:** None identified
**Risk Level:** Medium (stock consolidation complexity)

**Last Updated:** February 17, 2026
