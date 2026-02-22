# VaighaWeaves Migration - Claude Context

This file provides guidance for working on the VaighaWeaves → Medusa.js migration project.

---

## 🎯 Mission

Migrate VaighaWeaves e-commerce platform from **Express + React** to **Medusa.js + Next.js** to fix critical production issues while maintaining 100% UI compatibility.

---

## 📁 Project Structure

```
migration/
├── CLAUDE.md                    ← You are here
├── README.md                    Quick start guide
│
├── vaighaweaves-medusa/        [PHASE 1-5] New Medusa.js backend ✅ Running
│   ├── medusa-config.ts        ← All modules + providers registered
│   ├── src/
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── stock-events/            ✅ Phase 1
│   │   │   │   │   ├── route.ts              GET (list) + POST (manual adjust)
│   │   │   │   │   └── [variant_id]/route.ts GET (audit trail per variant)
│   │   │   │   ├── stock-reservations/      ✅ Phase 1
│   │   │   │   │   └── route.ts              GET (list with filters)
│   │   │   │   ├── product-metadata/        ✅ Phase 2
│   │   │   │   │   ├── route.ts              GET (list+filter) + POST (upsert)
│   │   │   │   │   └── [product_id]/route.ts GET by product ID
│   │   │   │   ├── image-optimizer/         ✅ Phase 2
│   │   │   │   │   ├── route.ts              POST (reprocess) + GET (variants)
│   │   │   │   │   └── backfill/route.ts     POST (batch backfill)
│   │   │   │   ├── webhook-monitor/         ✅ Phase 3
│   │   │   │   │   └── route.ts              GET (list+health) + POST (retry)
│   │   │   │   └── shipments/               ✅ Phase 3
│   │   │   │       ├── route.ts              GET (list) + POST (create fulfillment)
│   │   │   │       └── [id]/route.ts         GET (detail) + POST (trigger tracking)
│   │   │   └── store/
│   │   │       └── products/[id]/metadata/route.ts  ✅ Public GET
│   │   ├── jobs/                            ✅ Phase 3
│   │   │   ├── webhook-health-check.ts       Cron every 30 min
│   │   │   └── shipment-tracking-sync.ts     Cron every 15 min
│   │   ├── links/
│   │   │   └── product-product-metadata.ts   ✅ defineLink(Product ↔ ProductMetadata)
│   │   ├── modules/
│   │   │   ├── stock-events/                ✅ Phase 1 COMPLETE
│   │   │   │   ├── models/{stock-event,stock-reservation}.ts
│   │   │   │   ├── service.ts               StockEventModuleService (7 methods)
│   │   │   │   ├── utils.ts                 getVariantStock() shared helper
│   │   │   │   ├── index.ts                 STOCK_EVENTS_MODULE
│   │   │   │   └── __tests__/               18 service + 9 locking tests
│   │   │   ├── product-metadata/            ✅ Phase 2 COMPLETE
│   │   │   │   ├── models/product-metadata.ts  20 typed fields
│   │   │   │   ├── service.ts               upsert, viewCount, filter
│   │   │   │   ├── index.ts                 PRODUCT_METADATA_MODULE
│   │   │   │   └── __tests__/               11 unit tests
│   │   │   ├── image-optimizer/             ✅ Phase 2 COMPLETE
│   │   │   │   ├── models/image-variant.ts   Responsive image tracking
│   │   │   │   ├── service.ts               Sharp + S3 processing
│   │   │   │   ├── index.ts                 IMAGE_OPTIMIZER_MODULE
│   │   │   │   └── __tests__/               11 unit tests
│   │   │   ├── payment-razorpay/            ✅ Phase 3 COMPLETE
│   │   │   │   ├── service.ts               RazorpayProviderService (10 methods)
│   │   │   │   ├── index.ts                 ModuleProvider(Modules.PAYMENT)
│   │   │   │   └── __tests__/               29 unit tests
│   │   │   ├── webhook-monitor/             ✅ Phase 3 COMPLETE
│   │   │   │   ├── models/webhook-event.ts   DLQ event model
│   │   │   │   ├── service.ts               queue, retry, health status
│   │   │   │   ├── index.ts                 WEBHOOK_MONITOR_MODULE
│   │   │   │   └── __tests__/               10 unit tests
│   │   │   └── fulfillment-indian-carriers/ ✅ Phase 3 COMPLETE
│   │   │       ├── india-post-client.ts      BExT API client (auth, book, track, tariff)
│   │   │       ├── service.ts               IndianCarriersFulfillmentService
│   │   │       ├── index.ts                 ModuleProvider(Modules.FULFILLMENT)
│   │   │       └── __tests__/               18 unit tests
│   │   └── subscribers/
│   │       ├── order-placed.ts              ✅ Lock + idempotency + reserveStock
│   │       └── order-cancelled.ts           ✅ Lock + idempotency + releaseStock
│   └── package.json
│
├── vaighaweaves-nextjs/        [PHASE 6] New Next.js frontend 🚧 IN PROGRESS
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                  Root layout: fonts, providers, Toaster
│   │   │   ├── not-found.tsx               Global 404
│   │   │   ├── middleware.ts               Auth guard (httpOnly cookie check)
│   │   │   ├── (store)/                   Public storefront group
│   │   │   │   ├── layout.tsx              Navbar + MobileBottomNav + Footer
│   │   │   │   ├── page.tsx                Home
│   │   │   │   ├── shop/page.tsx           Shop (product listing)
│   │   │   │   ├── product/[handle]/page.tsx  Product detail (slug-based)
│   │   │   │   ├── categories/[handle]/page.tsx
│   │   │   │   ├── cart/page.tsx
│   │   │   │   ├── videos/page.tsx
│   │   │   │   ├── about-us/page.tsx
│   │   │   │   ├── contact/page.tsx
│   │   │   │   ├── faqs/page.tsx
│   │   │   │   ├── shipping-policy/page.tsx
│   │   │   │   ├── privacy-policy/page.tsx
│   │   │   │   └── terms/page.tsx
│   │   │   ├── (auth)/                    Public auth group (redirect if logged in)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   ├── forgot/page.tsx
│   │   │   │   ├── reset-password/page.tsx
│   │   │   │   └── auth/callback/page.tsx  Google OAuth server-side redirect
│   │   │   ├── (checkout)/                Checkout group (no footer)
│   │   │   │   └── checkout/page.tsx
│   │   │   └── (account)/                 Protected customer group
│   │   │       ├── layout.tsx
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── profile/page.tsx
│   │   │       ├── orders/page.tsx
│   │   │       ├── orders/[id]/page.tsx
│   │   │       ├── wishlist/page.tsx
│   │   │       └── payment/success/page.tsx
│   │   ├── modules/                       Feature modules (mirrored from storefront)
│   │   │   ├── products/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   │   └── components/
│   │   │   │       └── payment-providers/  NEW: one file per provider
│   │   │   │           ├── razorpay/index.tsx
│   │   │   │           └── cod/index.tsx   (future: cash on delivery)
│   │   │   ├── account/
│   │   │   ├── wishlist/                  NEW: no Medusa template
│   │   │   ├── videos/                    NEW: custom to VaighaWeaves
│   │   │   └── layout/
│   │   ├── lib/                           Server utilities
│   │   │   ├── session.ts                 httpOnly cookie reader (server-side)
│   │   │   ├── region.ts                  DEFAULT_REGION_ID = India (hard-coded)
│   │   │   ├── data/                      Medusa SDK fetch helpers
│   │   │   └── queryKeys.ts               TanStack Query key namespacing
│   │   ├── hooks/                         Client-side hooks (useProducts etc.)
│   │   ├── types/                         Ported from vaighaweaves-ui/src/types/
│   │   └── styles/
│   ├── next.config.js
│   ├── next-sitemap.js                    Dynamic sitemap (all 95 products + 92 categories)
│   ├── tailwind.config.js                 Ported brand tokens from old UI
│   └── package.json
│
├── data-migration/             MySQL → PostgreSQL migration scripts ✅ ALL COMPLETE
│   ├── 01-setup-schema.ts              ✅ Schema + custom tables
│   ├── 02-migrate-categories.ts        ✅ 92 categories
│   ├── 03-migrate-products.ts          ✅ 117 products
│   ├── 04-migrate-images.ts            ✅ 1311 images
│   ├── 05-migrate-variants-stock.ts    ✅ 127 variants + inventory
│   ├── 06-migrate-users.ts             ✅ 2573 users (4 admin + 2569 customers)
│   ├── 07-migrate-addresses.ts         ✅ 610 addresses
│   ├── 08-migrate-orders.ts            ✅ 864 orders, 1205 items
│   ├── 09-migrate-payments.ts          ✅ 863 payments
│   ├── 10-migrate-stock-events.ts      ✅ 36 stock events
│   ├── 11-migrate-shipments.ts         ✅ 0 (source empty)
│   ├── 12-verify-migration.ts          ✅ All checks passed
│   ├── 13-migrate-stock-reservations.ts ✅ 1049 reservations
│   ├── 14-migrate-product-metadata.ts  ✅ 117 metadata + 117 link rows (Phase 2)
│   ├── 15-backfill-responsive-images.ts ✅ Ready (needs AWS creds at runtime)
│   └── 16-verify-phase2.ts             ✅ 14/14 checks passed
│
└── testing/                    Parallel API comparison tests ✅ Phase 4 COMPLETE
    ├── compare-products.ts     ✅ 5/5 PASS (95/95 matched, 100%)
    ├── compare-stock.ts        ✅ 3/3 PASS (93/95 matched, 97.9%)
    ├── compare-orders.ts       ✅ 4/4 PASS (864/864 exact match)
    ├── compare-payments.ts     ✅ 4/4 PASS (863/863 exact, Rs.7,270.64)
    ├── load-test.yml           Artillery config (4 phases, 100 users/sec spike)
    ├── tsconfig.json           ES2020, strict, commonjs
    ├── .env                    API URLs, publishable key, DB credentials
    ├── utils/
    │   ├── normalize.ts        Product/Order/Payment normalization
    │   ├── auth.ts             Medusa admin/store API clients
    │   ├── id-map.ts           migration_id_map PostgreSQL loader
    │   └── reporter.ts         Results formatting + JSON export
    └── results/                Test output logs (JSON with timestamps)
```

---

## 🚨 Critical Pain Points Being Fixed

### 1. **Stock/Inventory Sync Bug** (P0 - CRITICAL) ✅ FIXED IN PHASE 1.3
**Old Problem:**
```typescript
// OLD: Dual-stock system (VaighaWeaves)
Product.stockQty = 100           // Total stock
ProductImage.stockQty = 25       // Per design/color stock
// These go OUT OF SYNC after orders/cancellations
```

**New Solution (IMPLEMENTED):**
```typescript
// NEW: Single source of truth (Medusa)
inventory_level.stocked_quantity = 100   // Medusa's canonical value
StockEvent (append-only audit log)       // Every change recorded
StockReservation (active holds table)    // Phone/walkin/online holds
```

**Module:** `src/modules/stock-events/` — resolves via `STOCK_EVENTS_MODULE`

---

### 2. **Razorpay Webhook Failures** (P0 - CRITICAL) ✅ FIXED IN PHASE 3
**Old Problem:**
- Webhooks randomly disabled
- No monitoring/alerting
- Manual re-registration needed

**New Solution (IMPLEMENTED):**
- Custom Razorpay payment provider (`payment-razorpay`) with webhook signature verification
- Webhook health check cron job (every 30 minutes)
- Dead letter queue via `webhook-monitor` module + PostgreSQL-backed event tracking
- Admin API: `GET /admin/webhook-monitor?summary=true` for health dashboard
- Retryable events with exponential backoff (1, 5, 15, 30, 60 min)

---

### 3. **Other Issues**
- Railway platform latency → Better hosting + optimized queries
- Admin product upload bugs → Medusa admin panel (much better UX)
- No test coverage → TDD approach, 80%+ coverage requirement

---

## 📅 Migration Phases

### ✅ **Phase 0: Setup** (Week 0 - Feb 16-17, 2026) - COMPLETED
- [x] Created folder structure
- [x] Documentation (progress tracker, API mapping, Git strategy)
- [x] Testing framework
- [x] Automation scripts

### ✅ **Phase 1: Core Infrastructure** (Week 1-2 - Feb 18-20, 2026) - COMPLETED
**Focus:** Stock/Inventory Management

**Module 1.1: Medusa Setup** ✅ COMPLETE (Feb 17, 2026)
- Medusa 2.13.1 initialized in `vaighaweaves-medusa/`
- Backend running: http://localhost:9000
- Admin dashboard: http://localhost:9000/app
- Git commit: `885cc1e Phase 1.1 COMPLETE: Medusa backend running`

**Module 1.2: Database Migration** ✅ COMPLETE (Feb 18, 2026)

All 13 scripts ran successfully. Final record counts:

| Script | Entity | Records |
|--------|--------|---------|
| 01 | Schema + custom tables | — |
| 02 | Categories | 92 |
| 03 | Products | 117 |
| 04 | Product images | 1,311 |
| 05 | Variants + inventory | 127 variants, 127 inv items |
| 06 | Users | 4 admin + 2,569 customers |
| 07 | Addresses | 610 |
| 08 | Orders + line items | 864 orders, 1,205 items |
| 09 | Payments | 863 |
| 10 | Stock events | 36 |
| 11 | Shipments | 0 (source empty) |
| 12 | Verification | ✅ ALL CHECKS PASSED |
| 13 | Stock reservations | 1,049 |

**Total ID mappings in `migration_id_map`: ~7,631**

Key migration notes:
- `product_variants` table in MySQL was empty; 127 Medusa variants generated from `product_images` + size data in script:05
- 50 orders have no `customer_id` (walk-in / offline / guest orders — expected)
- 5 addresses skipped (belonged to admin users, not customers)
- `stock_event.variant_id` altered to nullable (`ALTER TABLE stock_event ALTER COLUMN variant_id DROP NOT NULL`)
- `order_payment_collection` has composite PK `(order_id, payment_collection_id)` + separate NOT NULL `id` varchar
- Variant mapping key in `migration_id_map` is `product_variants` → `product_variant`
- Triple-stock bug fixed by using only `ProductImageSizeStock` values as the single source of truth

**Module 1.3: Stock Management Plugin** ✅ COMPLETE (Feb 19, 2026)
**Module 1.3b: PostgreSQL Advisory Locks** ✅ COMPLETE (Feb 20, 2026)

Built using TDD (Red → Green). 12 TypeScript files, 0 type errors, 27 unit tests (all passing).

**Files created/modified:**
```
src/modules/stock-events/
├── models/stock-event.ts          StockEvent model (maps to existing stock_event table)
├── models/stock-reservation.ts    StockReservation model (maps to stock_reservation table)
├── service.ts                     StockEventModuleService — 7 business logic methods
├── index.ts                       Module export: STOCK_EVENTS_MODULE = "stockEvents"
├── utils.ts                       ✅ NEW: getVariantStock() shared helper (DRY)
└── __tests__/
    ├── stock-event.service.unit.spec.ts  18 TDD unit tests (service logic)
    └── locking.unit.spec.ts             ✅ NEW: 9 locking + idempotency tests

src/subscribers/
├── order-placed.ts    ✅ UPDATED: lock per variant + idempotency + reserveStock()
└── order-cancelled.ts ✅ UPDATED: lock per variant + idempotency + releaseStock()

src/api/admin/
├── stock-events/route.ts          ✅ UPDATED: POST uses lock + fresh stock fetch
├── stock-events/[variant_id]/route.ts  GET audit trail for a variant
└── stock-reservations/route.ts    GET reservations with status/type filters
```

**StockEventModuleService methods:**
```typescript
reserveStock(variantId, quantity, currentStock, options?)   // order placed / phone booking
releaseStock(variantId, quantity, currentStock, options?)   // order cancelled
recordSale(variantId, quantity, currentStock, orderId)      // order fulfilled
adjustStock(variantId, delta, currentStock, reason, adminId) // admin manual fix
getStockHistory(variantId)         // full audit trail for admin panel
getActiveReservations(variantId)   // all ACTIVE holds on a variant
expireStaleReservations()          // run from cron job every 5 min
```

**Admin API endpoints:**
```
GET  /admin/stock-events                   → list events (?variant_id= ?event_type=)
GET  /admin/stock-events/:variant_id       → audit trail for one variant
POST /admin/stock-events                   → manual stock adjustment
GET  /admin/stock-reservations             → list holds (?status= ?reservation_type=)
```

**medusa-config.ts:** stock-events module registered under `modules: [{ resolve: "./src/modules/stock-events" }]`

**DB migration:** ✅ COMPLETE (Feb 19, 2026)
- Module name for CLI commands is **`stockEvents`** (camelCase), NOT `stock-events`
  - `npx medusa db:generate stockEvents` — generates migration
  - `npx medusa db:migrate` — applies it
- Tables `stock_event` and `stock_reservation` were pre-created by data-migration script 01
- The generated migration was rewritten to `ALTER TABLE ADD COLUMN IF NOT EXISTS` instead of `CREATE TABLE IF NOT EXISTS` to add Medusa-required columns (`deleted_at`, `updated_at`, `quantity_change`, `new_quantity`, `reservation_type`, `expiry_at`) to the existing tables
- Migration file: `src/modules/stock-events/migrations/Migration20260219174712.ts`

**DATABASE_URL:** `.env` must point to `postgresql://prudhviprabhat@localhost:5432/vaighaweaves_db_dev` (local trust auth, no password)

**Module 1.3b — Advisory Locks implementation:**

The concurrency problem: between `fetchStock()` and `reserveStock()` a concurrent order can consume the same stock (TOCTOU race). Solution: `pg_advisory_xact_lock` via Medusa's built-in `@medusajs/locking` + `@medusajs/locking-postgres`.

Lock key pattern: `stock:${variant_id}` — serialises all mutations for a variant.

**How it works (subscribers):**
```typescript
// 1. Acquire advisory lock for this variant
await lockingModule.execute(`stock:${variant_id}`, async () => {
  // 2. Idempotency check — skip if already processed
  const existing = await stockService.listStockReservations({
    order_id: orderId, variant_id, status: "ACTIVE"
  })
  if (existing.length > 0) return  // already reserved

  // 3. Fetch fresh stock INSIDE the lock (no stale read)
  const currentStock = await getVariantStock(inventoryModule, sku)

  // 4. Reserve / release
  await stockService.reserveStock(variant_id, qty, currentStock, opts)
}, { timeout: 5 })
```

**Admin API POST change:** `current_stock` is no longer accepted from the request body. Stock is fetched fresh from inventory inside the lock using `variant_sku`.

**Guarantees:**
- ✅ No overselling (two concurrent orders for last 5 units both see stock=5)
- ✅ No duplicate reservations (Medusa retry of `order.placed`)
- ✅ No lost updates (concurrent release + fulfillment on same reservation)
- ✅ Service layer unchanged — locking is in callers only (18 service tests unaffected)

**Run unit tests:**
```bash
cd vaighaweaves-medusa
npm run test:unit
# 27 tests (18 service + 9 locking), clean exit, no DB needed
# Test suites: 2 passed, 2 total — Time: ~1s
```

**Jest config notes:**
- `jest.config.js`: `setupFiles` (MikroORM MetadataStorage.clear()) only loads for integration tests, NOT unit tests — prevents open handles
- `package.json`: `test:unit` does NOT use `--forceExit` (tests exit cleanly)

---

### ✅ **Phase 2: Product Catalog** (Feb 20, 2026) - COMPLETE
**Focus:** Products, Categories, Images

**Part A: Product Metadata Module** ✅ COMPLETE
Custom Medusa module `productMetadata` with 20 typed columns, linked 1:1 to `product` via `defineLink`.

**Files created:**
```
src/modules/product-metadata/
├── models/product-metadata.ts    20 typed fields (brand, fabric, occasion, etc.)
├── service.ts                    upsertForProduct, incrementViewCount, getFeaturedProducts, filterByAttributes
├── index.ts                      PRODUCT_METADATA_MODULE = "productMetadata"
└── __tests__/
    └── product-metadata.service.unit.spec.ts  11 TDD unit tests

src/links/product-product-metadata.ts    defineLink(Product ↔ ProductMetadata)

src/api/admin/product-metadata/
├── route.ts                     GET (list+filter) + POST (upsert)
└── [product_id]/route.ts        GET metadata by product ID

src/api/store/products/[id]/metadata/route.ts  Public GET endpoint
```

**Part B: Image Optimizer Module** ✅ COMPLETE
Sharp-based responsive image generation (4 sizes: thumb/sm/md/lg in WebP) + S3 upload.

**Files created:**
```
src/modules/image-optimizer/
├── models/image-variant.ts       Tracks responsive sizes per image
├── service.ts                    generateSizes, processAndUpload, processFromUrl, getVariantsForImage
├── index.ts                      IMAGE_OPTIMIZER_MODULE = "imageOptimizer"
└── __tests__/
    └── image-optimizer.service.unit.spec.ts  11 TDD unit tests

src/api/admin/image-optimizer/
├── route.ts                     POST (reprocess) + GET (list variants)
└── backfill/route.ts            POST (batch backfill)
```

**DB Migrations Applied:**
- `Migration20260220044046` — product_metadata table
- `Migration20260220045342` — image_variant table
- Link table: `product_product_productmetadata_product_metadata`

**Data Migration:**
- Script 14: 117 products → 117 product_metadata records + 117 link rows
- Script 15: Backfill ✅ — 3,530 variants created for 1,205/1,311 images (106 missing from S3)
- Script 16: Verification — 17/17 checks passed (including image variants)

**Key Gotcha:** Medusa linkable keys are **camelCase** — `model.define("product_metadata")` → `Module.linkable.productMetadata` (NOT `.product_metadata`)

**Run tests:**
```bash
cd vaighaweaves-medusa
npm run test:unit
# 49 tests (27 stock-events + 11 product-metadata + 11 image-optimizer)
# 4 test suites, clean exit, ~1s
```

---

### ✅ **Phase 3: Orders & Payments + Fulfillment** (Feb 20-21, 2026) - COMPLETED
**Focus:** Razorpay Payment + India Post Fulfillment + Webhook DLQ

**Deliverables (all complete):**
- `payment-razorpay` — Medusa v2 payment provider (AbstractPaymentProvider, 10 methods)
  - Auto-capture + manual capture modes, webhook signature verification
  - Session data: order_id, payment_id, signature, amount_in_paise
  - 29 TDD unit tests
- `webhook-monitor` — Dead letter queue module (PostgreSQL-backed)
  - DLQ with exponential backoff retries (1, 5, 15, 30, 60 min)
  - Health status API, admin retry endpoint
  - Cron job every 30 min for health check
  - DB migration: `webhook_event` table (Migration20260221072058)
  - 10 TDD unit tests
- `fulfillment-indian-carriers` — India Post fulfillment provider
  - Speed Post + Business Parcel service types
  - BExT API client (auth, book, track, cancel, tariff, label)
  - Fallback weight-based tariff estimation
  - Status mapping (20+ India Post event codes → normalized statuses)
  - 18 TDD unit tests
- Admin API: shipments (list, create, detail, tracking sync)
- Scheduled jobs: webhook health check (30 min), shipment tracking sync (15 min)
- medusa-config.ts: all 3 providers registered
- 106 total unit tests passing (27 stock-events + 11 product-metadata + 11 image-optimizer + 29 razorpay + 10 webhook-monitor + 18 fulfillment)

---

### ✅ **Phase 4: Parallel Testing** (Feb 21-22, 2026) - COMPLETED
**Focus:** Validate Data Parity between old Express and new Medusa systems

**Test Results (ALL PASSING):**

| Script | Tests | Result | Details |
|--------|-------|--------|---------|
| `compare-products.ts` | 5/5 PASS | 95/95 products matched by handle (100%) | Medusa 13x faster |
| `compare-stock.ts` | 3/3 PASS | 93/95 matched (97.9%) | 2 variants differ (expected) |
| `compare-orders.ts` | 4/4 PASS | 864/864 exact match | All statuses verified |
| `compare-payments.ts` | 4/4 PASS | 863/863 exact match | Rs.7,270.64 completed revenue |

**Payment status distribution:** completed (527, 61.1%), cancelled (309, 35.8%), pending (27, 3.1%)
**Order status distribution:** delivered (470), processing (300), cancelled (56), pending (38)

**Key implementation notes:**
- Products/stock comparison requires both old Express (port 5001) and Medusa (port 9000) running
- Orders/payments comparison uses `migration_id_map` as source of truth (old Express admin uses Google OAuth, no password login)
- Medusa Store API requires `x-publishable-api-key` header (key in `.env`)
- Medusa payment endpoint: `GET /admin/payments?fields=*payment_collection` (NOT `/admin/payment-collections`)
- Payment `transactionId` stored in `payment_collection.metadata.transactionId` by migration script 09
- Old Express returns 1 row per product-image; scripts deduplicate by slug

**Files created (11 total):**
```
migration/testing/
├── compare-products.ts          Handle-based matching, slug dedup, normalized shapes
├── compare-stock.ts             Per-product aggregation, race condition test
├── compare-orders.ts            ID map validation, status distribution, orphan check
├── compare-payments.ts          Payment amounts, statuses, total revenue
├── load-test.yml                Artillery: 4 phases (5→50→100 users/sec)
├── tsconfig.json                ES2020, strict, commonjs
├── .env                         API URLs, publishable key, DB credentials
├── utils/
│   ├── normalize.ts             normalizeProduct, normalizeOrder, normalizePayment
│   ├── auth.ts                  medusaAdminClient, medusaStoreClient, getMedusaAdminToken
│   ├── id-map.ts                loadIdMap, loadIdMaps, reverseIdMap (PostgreSQL)
│   └── reporter.ts              printSummary, saveResults, measureTime
└── results/                     JSON output with timestamps
```

**Testing commands:**
```bash
cd migration/testing

# Quick smoke test (products + stock — requires both servers)
npm run test:quick

# Full comparison suite (all 4 scripts)
npm run test:all

# Individual scripts
npm run test:compare-products   # Product data parity
npm run test:compare-stock      # Stock levels + race condition
npm run test:compare-orders     # Order count, status, amounts
npm run test:compare-payments   # Payment amounts, revenue totals

# Load test (Medusa only, Artillery)
npm run test:load
```

**Success Criteria (MET):**
- ✅ 99%+ data parity — products 100%, stock 97.9%, orders 100%, payments 100%
- ✅ New API response time ≤ old API — Medusa 13x faster on products
- ✅ Zero data loss — every old record mapped in new system
- 🕒 Load test: p95 < 500ms at 100 concurrent users (Artillery config ready, not yet run)
- 🕒 Race condition test (requires both servers running simultaneously)

---

### **Phase 5: Cutover** (Week 6 - Mar 25-31, 2026) - PENDING
**Focus:** Gradual Traffic Migration

**Rollout:**
- Day 1-2: 10% traffic → Medusa
- Day 3: 50% traffic
- Day 4-5: 100% traffic
- Week 2-4: Monitor (keep old system as fallback)

**Rollback Triggers:**
- ❌ Error rate > 1%
- ❌ Stock overselling detected
- ❌ Payment failures > 5%

---

### **Pre-Phase 6: Wishlist Module** (Before Phase 6 starts) - REQUIRED
**Focus:** Build `wishlist` Medusa module so the Next.js UI has a stable backend API

**Why before Phase 6:** Building the module and UI simultaneously creates a feedback loop. The module is ~200 lines. Do it first.

**Deliverables:**
```
src/modules/wishlist/
├── models/wishlist-item.ts     customer_id, variant_id, product_id, created_at
├── service.ts                  addItem, removeItem, getByCustomer, clearAll
├── index.ts                    WISHLIST_MODULE
└── __tests__/
    └── wishlist.service.unit.spec.ts

src/api/store/customers/me/wishlist/
├── route.ts                    GET (list) / POST (add item)
└── [item_id]/route.ts          DELETE (remove item)
```

**Guest wishlist:** Store in `localStorage`, merge to server on login via `POST /store/customers/me/wishlist` for each item.

---

### **Phase 6: Next.js Frontend Migration** (Apr 1+, 2026) - IN PROGRESS
**Focus:** React (Vite SPA) → Next.js 14 App Router for SEO, performance, and SSR

---

#### **RESOLVED DECISIONS (all gaps closed)**

| # | Decision | Resolution |
|---|---|---|
| 1 | Admin panel | **Medusa Admin + custom routes** in `src/admin/routes/` — all 25 admin pages covered, no separate Next.js admin |
| 2 | Auth mechanism | **httpOnly cookie** via Route Handler; `middleware.ts` guards; CSRF utils removed |
| 3 | Wishlist | **Custom Medusa module** (Pre-Phase 6); localStorage fallback for guests |
| 4 | Razorpay frontend | **`payment-providers/razorpay/` Client Component**; `paymentInfoMap` entry; future gateways = 1 file each |
| 5 | Region routing | **Remove `[countryCode]` URL segment**; hard-code India in `lib/region.ts`; flat SEO URLs |
| 6 | Offline orders | **Medusa draft orders** + manual payment/fulfillment providers + `reservation-to-order` workflow |
| 7 | Sitemap | **`next-sitemap.js`** with dynamic product/category paths; `postbuild` script |
| 8 | Deployment | **Vercel (Next.js) + Railway (Medusa) + Cloudflare CDN free + Railway Redis** |

---

#### **Phase 6.0 — Foundation Setup** (2–3 days)
**Objective:** Scaffold Next.js from Medusa storefront template, configure for VaighaWeaves.

- Copy `vaighaweaves-server-storefront/` into `vaighaweaves-nextjs/` as base (already working Next.js 14 + Medusa SDK)
- Configure `.env.local`: `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`
- Port `tailwind.config.js` color palette + custom font tokens from old React UI
- Set up `@sentry/nextjs` (existing `sentry.ts` ports almost verbatim)
- Configure `next.config.js` — no `output: standalone` (Vercel handles deployment)
- Set up `@vercel/analytics/next`
- Port `src/types/` from React project — pure TypeScript interfaces, reuse as-is
- Remove `[countryCode]` route wrapper, flatten all routes to clean URLs

**Risks:**
- Verify `@medusajs/js-sdk` version matches backend (2.13.x)
- HostGator → Cloudflare DNS nameserver change needed before launch (see DNS section)

---

#### **Phase 6.1 — Routing Structure & Middleware** (2–3 days)
**Objective:** Full App Router directory tree + auth middleware.

**Route groups:**
- `(store)/` — public pages, shared Navbar + Footer layout
- `(auth)/` — login/register/forgot, no nav, redirect-if-logged-in guard
- `(checkout)/` — checkout-only layout (no footer)
- `(account)/` — protected customer pages (middleware enforces session)

**`middleware.ts`** replaces all `ProtectedRoute` / `AdminRoute` / `PublicRoute` components:
```typescript
const PROTECTED = ['/dashboard', '/orders', '/profile', '/wishlist', '/payment']
const AUTH_ONLY = ['/login', '/register']
// Read httpOnly cookie — if missing for protected path → redirect /login?returnTo=...
// Admin: handled by Medusa Admin at api.vaighaweaves.com/app (not in Next.js)
```

**Product URL change:** `product/:id` → `product/[handle]` (slug-based, SEO-friendly).

---

#### **Phase 6.2 — Authentication & Session** (3 days)
**Objective:** Replace `localStorage` JWT + `AuthContext` with httpOnly cookie session.

**Architecture:**
```
Browser → POST /api/auth/login (Next.js Route Handler)
              → Call Medusa POST /auth/customer/emailpass
              → Set-Cookie: medusa_session=<jwt>; HttpOnly; Secure; SameSite=Lax
              → 200 OK (no token in response body)

Subsequent requests: cookie sent automatically → read via cookies() in Server Components
No JS can access the token ✅  XSS cannot steal sessions ✅
```

**Key files:**
- `app/api/auth/login/route.ts` — Route Handler: proxy to Medusa, set cookie
- `app/api/auth/logout/route.ts` — Route Handler: clear cookie
- `app/api/auth/callback/route.ts` — Google OAuth server-side redirect flow
- `lib/session.ts` — `getSession()` reads cookie via `cookies()` from `next/headers`
- `AuthContext` (Client Component) — minimal; holds display-safe user shape (name, email, role) passed as prop from server layout, no polling

**CSRF removed:** Next.js Server Actions enforce `Origin` header matching by default. `csrfUtils` module is deleted.

---

#### **Phase 6.3 — Core Storefront Pages** (5–7 days)
**Objective:** Home, Shop, ProductDetail using Server Components + ISR.

**Rendering strategy:**

| Page | Strategy | Cache | Rationale |
|---|---|---|---|
| Home | SSG + ISR | `revalidate: 3600` | Featured/trending rarely change |
| Shop listing | SSR | `no-store` for filter URLs | Filter params are dynamic |
| Product detail | ISR | `revalidate: 60` | Stock needs near-real-time |
| Category pages | SSG + ISR | `revalidate: 3600` | Rarely change |
| FAQs / About / Legal | Static | No revalidation | No dynamic data |

**Product detail SEO:**
- `generateStaticParams` — pre-render all 95 handles at build time
- `generateMetadata` — dynamic OG tags per product (name, description, fabric, first image)
- JSON-LD structured data: `Product` schema (price, availability, brand, image)
- JSON-LD `BreadcrumbList` on product + category pages

**Key pattern change from React:** Replace `staleTime: 0` + `refetchOnMount: 'always'` with ISR revalidation + on-demand cache busting via `revalidatePath('/product/[handle]')` called from a Medusa webhook Route Handler when a product is updated.

**`FilterSidebar`:** Port as Client Component with URL-param state (`useSearchParams`/URL push) — filters become shareable links and SSR-crawlable (better than current React state approach).

**`ImageSlider`:** Port as `"use client"` + `dynamic(() => import('...'), { ssr: false })` for Swiper. Replace custom `OptimizedImage` IntersectionObserver with `next/image` (`priority={true}` above-fold, `placeholder="blur"` with SVG `blurDataURL`).

---

#### **Phase 6.4 — Cart & Checkout + Razorpay** (3–4 days)
**Objective:** Wire cart state and Razorpay into Medusa checkout flow.

**Cart:** Replace `CartWishlistContext` cart half with Medusa cart ID cookie (storefront template pattern — adopt wholesale).

**Razorpay checkout (`modules/checkout/components/payment-providers/razorpay/index.tsx`):**
```typescript
"use client"
import Script from 'next/script'
// Load Razorpay script via next/script strategy="lazyOnload" (only on checkout page)
// On click: open Razorpay checkout with order_id from session.data.razorpay_order_id
// On success: call Server Action to verify signature server-side → redirect /payment/success
// On failure: set error state, show toast
```

**`paymentInfoMap` entry in `lib/constants.ts`:**
```typescript
'pp_razorpay_razorpay': {
  title: 'Razorpay',
  icon: <CreditCard />,
}
```

**Adding a future gateway:** Add 1 file under `payment-providers/`, 1 entry in `paymentInfoMap`, 1 provider in `medusa-config.ts`. No other files touched.

**Offline payment providers registered in medusa-config.ts:**
```typescript
{ resolve: "@medusajs/payment-manual", id: "manual" }  // cash/card-terminal/UPI
{ resolve: "@medusajs/fulfillment-manual", id: "manual" }  // in-store pickup
```

---

#### **Phase 6.5 — Account & Customer Portal** (3 days)
**Objective:** Dashboard, Profile, Orders, Addresses, Wishlist.

- Use `modules/account/` storefront templates as base
- Port `ActiveSessions.tsx` → `modules/account/components/active-sessions/`
- Orders page: add cancellation modal + partial-cancellation logic as Client Component overlays
- Wishlist page: calls `GET /store/customers/me/wishlist` (Medusa module from Pre-Phase 6)
- Guest wishlist: read from `localStorage`, merge to server on login

---

#### **Phase 6.6 — Admin Panel: Medusa Admin Extensions** (4–5 days)
**Objective:** Port all 25 custom admin pages into Medusa Admin via extension system.

**What Medusa Admin covers natively (zero work needed):**
- Products, Orders, Customers, Inventory, Shipping, Payments, Promotions

**Custom routes to build in `src/admin/routes/`:**

| Your React page | Medusa Admin custom route | Priority |
|---|---|---|
| `AdminInStoreSales` | `in-store-sales/page.tsx` | P0 (high offline volume) |
| `AdminCreateOrder` | `in-store-sales/create/page.tsx` | P0 |
| `AdminStockReservations` | `stock-events/page.tsx` | P0 |
| `AdminStockSync` | `stock-sync/page.tsx` | P1 (phase out post-migration) |
| `AdminBanners` | `banners/page.tsx` | P1 |
| `AdminAnalytics` | `analytics/page.tsx` | P1 |
| `AdminAdvancedAnalytics` | `analytics/advanced/page.tsx` | P2 |
| `AdminEvents` | `events/page.tsx` | P2 |

**Branding:** Create `src/admin/theme.ts` to override Medusa UI color tokens to match VaighaWeaves brand palette.

**Offline order workflow — `reservation-to-order` Medusa workflow:**
```
src/workflows/reservation-to-order.ts
  Step 1: validateReservationActive(reservation_id)
  Step 2: createDraftOrder(guest_info, items_from_reservation)
  Step 3: completeOrder(draft_order_id)
  Step 4: updateReservation(reservation_id, { status: 'CONVERTED' })
  Step 5: deductStock(variant_id, qty)
  (Compensation: rollback each step if any fails — Medusa workflow rollback)
```

**Port strategy for `AdminCreateOrder.tsx` (1,839 lines → `in-store-sales/create/page.tsx`):**
- Keep 3-step wizard UI (customer selection → product selection → payment method) ~80% as-is
- Replace `adminService.createOrder()` → `fetch('/admin/draft-orders')` + `fetch('/admin/draft-orders/:id/complete')`
- Replace `adminService.getReservations()` → `fetch('/admin/stock-reservations')`
- Replace `useNavigate` from react-router → `useNavigate` from `@medusajs/admin-sdk`

---

#### **Phase 6.7 — SEO, Performance & Sitemap** (2 days)
**Objective:** Core Web Vitals + structured data + sitemap for all 95 products.

**`next-sitemap.js` configuration:**
```javascript
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://vaighaweaves.com',
  generateRobotsTxt: true,
  exclude: ['/admin*', '/api/*', '/auth/*', '/payment/*', '/dashboard', '/orders*', '/profile', '/wishlist', '/cart', '/checkout'],
  additionalPaths: async (config) => {
    // Fetch all 95 product handles from Medusa → priority 0.9, revalidate daily
    // Fetch all 92 categories → priority 0.8, revalidate weekly
  }
}
// In package.json: "postbuild": "next-sitemap"
```

**Priority hierarchy:** Home=1.0, Products=0.9, Categories=0.8, Shop/About/FAQs=0.7, Legal=0.6

**JSON-LD structured data:**
- `Product` schema on every product detail page (price, availability, brand, image)
- `BreadcrumbList` on category + product pages
- `Organization` schema on Home

**`next/font/google`** for web fonts (eliminates render-blocking Google Fonts request).

**`next/image`** replaces all `<OptimizedImage>`:  
- `priority={true}` on first above-fold product image
- `placeholder="blur"` with SVG `blurDataURL`
- `formats: ['image/avif', 'image/webp']` in `next.config.js`
- `remotePatterns` for CloudFront domain

---

#### **Phase 6.8 — Custom VaighaWeaves Pages** (2 days)
**Objective:** Port pages with no Medusa equivalent.

| Page | Approach |
|---|---|
| Videos | Server Component + `"use client"` `VideoPlayer`; migrate YouTube data to Medusa custom API endpoint |
| Contact | Static Server Component + Client `<form>` with Server Action |
| FAQs / About / Legal | Static Server Components — no API needed |
| MaintenancePage | `middleware.ts` rewrite to `/maintenance` based on env var feature flag |
| DevSiteGate | `middleware.ts` password-protected cookie check |

---

#### **Phase 6.9 — Testing & UI Cutover** (3 days)
**Objective:** Validate parity, then switch traffic from old React UI to Next.js.

- Extend `migration/testing/` scripts to assert `generateStaticParams` covers all 95 handles
- Playwright E2E: product search → detail → add to cart → checkout (Razorpay test mode)
- Lighthouse CI: LCP < 2.5s on mobile for ProductDetail
- Verify `next-sitemap` output covers all product + category URLs
- Deploy to Vercel with `vaighaweaves.com` custom domain
- Gradual rollout: 10% → 50% → 100% traffic to Next.js

**Rollback:** Point Vercel domain back to old React Vite build (Vercel instant rollback).

---

#### **Medusa Storefront Module Coverage (12 modules)**

| Module | Coverage | VaighaWeaves Action |
|---|---|---|
| `layout/` | Navbar, cart dropdown, side menu | Adapt + add MobileBottomNav |
| `home/` | Hero shell + featured products | Add CategoryCarousel, deals/trending |
| `products/` | Card, gallery, actions, tabs, related | Add size selector for READYMADE |
| `cart/` | Cart sidebar + item management | Adopt wholesale + Razorpay |
| `checkout/` | Address → shipping → payment → review | Add `payment-providers/razorpay/` |
| `account/` | Login, register, dashboard, addresses | Add ActiveSessions, Google OAuth |
| `order/` | Order confirmation page | Adapt + add cancellation modal |
| `store/` | Product listing grid | Add FilterSidebar (URL-param driven) |
| `categories/` | Category landing page | Adopt + add subcategory cards |
| `collections/` | Collection page | Minor adaptation |
| `common/` | Icons, dividers, form errors | Adopt as-is |
| `skeletons/` | Loading skeletons | Adopt as-is |
| **Wishlist** | ❌ Not covered | Build from React port |
| **Videos** | ❌ Not covered | Build new module |

---

#### **Component Server/Client Decision Guide**

| Component | Type | Reason |
|---|---|---|
| Navbar (links, logo) | Server | No interactivity |
| Cart icon (count badge) | Client | Reads cart state |
| ProductCard (image + price) | Server | Pure display |
| ProductCard wishlist button | Client | Event handler |
| FilterSidebar | Client | useState + useSearchParams |
| ImageSlider (Swiper) | Client | Browser API |
| PaymentModal (Razorpay) | Client | Third-party script |
| next/image | Server | Built-in optimization |
| Home hero | Server | Static content |
| CategoryCarousel | Server (data) + Client shell | Scroll interaction |
| ErrorBoundary | Client | React lifecycle |

---

#### **State Management in Next.js**

| Concern | Solution |
|---|---|
| Auth user shape | Minimal Client Context (populated once from server layout prop) |
| Cart | Medusa cart cookie + Server Actions — no Context needed |
| Wishlist | Custom Context (port of CartWishlistContext wishlist half) |
| Server data (products, orders) | `fetch` with `cache` in Server Components; React Query on client |
| UI state (modal open, filter drawer) | Local `useState` — no global store |
| Toast notifications | `react-hot-toast` with `"use client"` provider wrapper |

---

## 🏗️ Architecture & Design Patterns

### **Backend Architecture (Medusa.js)**

```
┌──────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                     │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│  API LAYER (Medusa)                                   │
│  - /store/* (customer-facing)                        │
│  - /admin/* (admin panel)                            │
│  - Custom: stock-events, shipments, webhook-monitor, etc. │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│  SERVICE LAYER (Business Logic)                      │
│  - Built-in: ProductService, OrderService, etc.     │
│  - Custom: StockEvents, Razorpay, Fulfillment, etc.  │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│  POSTGRESQL DATABASE                                  │
│  - Medusa core tables (product, order, customer)    │
│  - Custom: stock_event, stock_reservation, webhook_event │
└──────────────────────────────────────────────────────┘
```

### **Key Design Patterns**

1. **Event Sourcing** (Stock Management) ✅ IMPLEMENTED
   - All stock changes = immutable StockEvent records
   - Append-only log (never update/delete events)
   - Current stock = Medusa's `inventory_level.stocked_quantity`
   - StockEvent provides the audit trail / "why"

2. **Repository Pattern** (Data Access)
   - MedusaService generates CRUD methods automatically
   - Custom business logic layered on top

3. **Service Layer Pattern** (Business Logic)
   - API routes → StockEventModuleService → DB
   - Subscribers → StockEventModuleService → DB

4. **Factory Pattern** (Pluggable Providers) ✅ IMPLEMENTED
   - Payment: Razorpay (ModuleProvider pattern)
   - Fulfillment: India Post Speed Post + Business Parcel

5. **Observer Pattern** (Event-Driven) ✅ IMPLEMENTED
   - `order.placed` → `order-placed.ts` subscriber → reserveStock()
   - `order.cancelled` → `order-cancelled.ts` subscriber → releaseStock()

6. **Adapter Pattern** (Frontend Compatibility)
   - Maps Medusa responses → old API format
   - React components see identical data structure
   - Zero UI changes needed

7. **Circuit Breaker** (Fault Tolerance) ✅ IMPLEMENTED
   - Razorpay API failures → fallback handling in payment provider
   - India Post tariff API failure → weight-based estimation fallback

8. **Retry Pattern** (Resilience) ✅ IMPLEMENTED
   - Webhook delivery retries (exponential backoff: 1, 5, 15, 30, 60 min)
   - Dead letter queue for permanent failures (webhook_event table)

---

## 🧪 Test-Driven Development (TDD)

### **Test Pyramid**
```
       /\
      /E2E\         ← 10% (slow, expensive, high confidence)
     /──────\
    /Integration\   ← 20% (medium speed, medium confidence)
   /────────────\
  /   Unit Tests  \ ← 70% (fast, cheap, high confidence)
 /────────────────\
```

### **TDD Red-Green-Refactor Cycle**
1. **Red:** Write failing test
2. **Green:** Write minimal code to pass
3. **Refactor:** Clean up while keeping tests green
4. **Repeat**

### **Coverage Requirements**
- Unit tests: **80%+ coverage**
- Integration tests: All critical flows (checkout, payment, stock)
- E2E tests: Top 5 user journeys
- Performance tests: Load testing before production

### **Unit Tests Written (Phase 1.3 + 1.3b + Phase 2)**

**File:** `src/modules/stock-events/__tests__/stock-event.service.unit.spec.ts` (18 tests)
- reserveStock: success, insufficient stock, zero qty, negative qty, edge (qty === stock), PHONE type, expiry_at set, expiry_at null
- releaseStock: success, cancels matching reservation, no reservation found, zero/negative qty
- recordSale: marks FULFILLED + SOLD event
- adjustStock: positive delta, negative delta
- getStockHistory: calls listStockEvents with variant filter
- expireStaleReservations: expires past-due only, returns count

**File:** `src/modules/stock-events/__tests__/locking.unit.spec.ts` (9 tests)
- order-placed: acquires `stock:<variant_id>` lock per item, fetches fresh stock inside lock, skips when reservation already exists (idempotency), skips items without variant_id, does not throw on lock failure
- order-cancelled: acquires lock per item, fetches fresh stock inside lock, skips when no ACTIVE reservation (idempotency), does not throw on lock failure

**File:** `src/modules/product-metadata/__tests__/product-metadata.service.unit.spec.ts` (11 tests)
- upsertForProduct: creates new, updates existing, partial update
- incrementViewCount: 0→1, N→N+1
- getFeaturedProducts: returns featured only, empty when none
- filterByAttributes: single filter, multiple filters, no filters, undefined values ignored

**File:** `src/modules/image-optimizer/__tests__/image-optimizer.service.unit.spec.ts` (11 tests)
- generateSizes: 4 sizes from 1500px, skips larger than original, WebP format, fit:inside
- generateS3Key: correct path structure
- processAndUpload: creates records, uploads to S3, CloudFront URLs, CacheControl header
- getVariantsForImage: filter by image_id
- getVariantsForImages: grouped by image_id

---

## 📝 Common Commands

### **Development**

```bash
# Start Medusa backend
cd vaighaweaves-medusa/
npm run dev
# Backend: http://localhost:9000
# Admin:   http://localhost:9000/app

# Start Next.js frontend (Phase 6)
cd vaighaweaves-nextjs/
npm run dev
# Frontend: http://localhost:3000

# Start old stack (for comparison)
cd ../..
./scripts/start-old.sh

# Start both stacks (parallel testing)
./scripts/start-parallel.sh

# Stop all
./scripts/stop-all.sh
```

### **Database**

```bash
cd vaighaweaves-medusa/

# Run Medusa core migrations
npx medusa db:migrate

# Generate module migration (use camelCase module name!)
npx medusa db:generate stockEvents
npx medusa db:migrate

# Rollback last migration
npx medusa db:rollback

# Check DB connection
psql -d vaighaweaves_db_dev -c "SELECT 1"
```

### **Testing**

```bash
cd vaighaweaves-medusa/

# Unit tests (TDD — runs in seconds, no DB needed)
npm run test:unit

# Integration tests (requires running Medusa + PostgreSQL)
npm run test:integration:modules    # Module-level
npm run test:integration:http       # HTTP endpoint level

# Watch mode (during active development)
npm run test:unit -- --watch
```

### **Data Migration**

```bash
cd ../data-migration/

# Re-run any individual script
npm run script:12   # Re-run verification at any time

# Run all from scratch (if resetting DB)
npm run migrate:all
```

### **Parallel Testing**

```bash
cd ../testing/

# Run comparison tests
npm run test:compare-products    # 5/5 PASS — 95/95 products matched
npm run test:compare-stock       # 3/3 PASS — 93/95 matched (97.9%)
npm run test:compare-orders      # 4/4 PASS — 864/864 exact match
npm run test:compare-payments    # 4/4 PASS — 863/863, Rs.7,270.64 revenue
npm run test:all                 # Run all 4 comparison scripts
npm run test:quick               # Products + stock only (quick smoke test)
npm run test:load                # Artillery load test (Medusa only)
```

---

## 🔌 Custom Modules Status

### **Phase 1 — Stock Management** ✅ COMPLETE
1. **stock-events module** ✅ (Feb 20, 2026)
   - Event-sourced stock management + admin audit trail API
   - PostgreSQL advisory locks + idempotency on subscribers
   - 27 TDD unit tests (18 service + 9 locking)

### **Phase 2 — Product Catalog** ✅ COMPLETE
2. **product-metadata module** ✅ (Feb 20, 2026)
   - 20 typed columns, defineLink to Product, upsert + filter APIs
   - 11 TDD unit tests

3. **image-optimizer module** ✅ (Feb 20, 2026)
   - S3 upload, responsive sizes (150/400/800/1200px), WebP
   - 11 TDD unit tests

### **Phase 3 — Orders & Payments + Fulfillment** ✅ COMPLETE
4. **payment-razorpay** ✅ (Feb 21, 2026)
   - Razorpay payment provider (AbstractPaymentProvider, 10 methods)
   - Webhook signature verification, auto-capture + manual modes
   - 29 TDD unit tests

5. **webhook-monitor** ✅ (Feb 21, 2026)
   - Dead letter queue with exponential backoff
   - Health check cron (30 min), admin API
   - DB table: webhook_event
   - 10 TDD unit tests

6. **fulfillment-indian-carriers** ✅ (Feb 21, 2026)
   - India Post fulfillment provider (Speed Post + Business Parcel)
   - BExT API client, tracking sync, tariff calculation
   - 18 TDD unit tests

### **Pre-Phase 6: Wishlist Module** 🔴 REQUIRED BEFORE PHASE 6
7. **wishlist module** (~200 lines) — Customer wishlist
   - `models/wishlist-item.ts` + `service.ts` + store API
   - `GET/POST /store/customers/me/wishlist` + `DELETE /store/customers/me/wishlist/:item_id`
   - Guest fallback: localStorage, merge on login
   - TDD: unit tests required

### **Phase 6 Backend Prerequisites** 🕒 PENDING
8. **manual payment provider** — `@medusajs/payment-manual` (register in medusa-config.ts for in-store cash/UPI)
9. **manual fulfillment provider** — `@medusajs/fulfillment-manual` (register for in-store pickup)
10. **reservation-to-order workflow** — `src/workflows/reservation-to-order.ts` (5-step with compensation)

### **Post-Phase 6** 🕒 OPTIONAL
11. **medusa-plugin-gst-tax** (~400 lines) — HSN-based GST: CGST/SGST/IGST
12. **medusa-plugin-analytics** (~300 lines) — Dashboard metrics
13. **medusa-plugin-reviews** (~250 lines) — Product reviews

---

## 📊 Success Metrics

### **Technical Metrics**
- ✅ Stock sync bugs eliminated (zero discrepancies)
- ✅ Razorpay webhooks 99.9% uptime (Phase 3)
- ✅ API response time improved 30%+
- ✅ Test coverage > 80%
- ✅ Admin product upload < 30 seconds (vs 2 minutes old)

### **Business Impact**
- ✅ Customer complaints reduced 50%+
- ✅ Admin time saved 2+ hours/day
- ✅ Revenue loss from overselling eliminated
- ✅ Server costs reduced 20%+ (better efficiency)

---

## 🚨 Rollback Plan

### **Immediate Rollback** (< 5 minutes)
```bash
# Revert React frontend to old API
cd ../../vaighaweaves-ui
echo "VITE_API_URL=http://localhost:5001/api" > .env.production
npm run build
vercel --prod

# Old system continues serving traffic
# New Medusa kept running for debugging
```

### **Rollback Triggers**
- ❌ Error rate > 1%
- ❌ Stock overselling detected
- ❌ Payment failures > 5%
- ❌ Customer complaints spike

---

## 🌐 Infrastructure & Deployment Architecture

### **Production Stack (Post Phase 6)**

```
vaighaweaves.com       ──Cloudflare CDN──► Vercel (Next.js)
api.vaighaweaves.com   ──Cloudflare CDN──► Railway (Medusa + Admin at /app)
Images                                   AWS S3 + CloudFront (existing, unchanged)

Domain registrar: HostGator (keep — only change nameservers)
DNS authority:    Cloudflare (free plan)
Frontend host:    Vercel (Hobby → Pro when needed)
Backend host:     Railway (Medusa API + PostgreSQL + Redis)
```

### **Cloudflare Setup (Required Before Launch)**

1. Sign up at cloudflare.com → Add site `vaighaweaves.com`
2. Cloudflare imports existing HostGator DNS records automatically
3. In HostGator cPanel → Domain Manager → Nameservers → enter Cloudflare NS addresses
4. SSL/TLS mode: **Full (Strict)** — both legs encrypted

**DNS Records in Cloudflare:**

| Name | Type | Value | Proxied |
|---|---|---|---|
| `@` | CNAME | `cname.vercel-dns.com` | ✅ Yes |
| `www` | CNAME | `cname.vercel-dns.com` | ✅ Yes |
| `api` | CNAME | `your-app.railway.app` | ✅ Yes |

**Cloudflare caching rules:**
- Cache `/store/products*` → TTL 5 minutes (edge cache reduces Railway calls)
- Cache `/store/product-categories*` → TTL 1 hour
- Bypass `/admin/*`, `/store/cart*`, `/auth/*` → Never cache

### **Railway Additions Needed**

- **Redis** (add as Railway service) — required for Medusa's event bus reliability; prevents webhook queue loss on restarts
- **Daily DB backups** — configure via Railway backup cron (864+ real orders to protect)

### **`next.config.js` (Vercel — no `output: standalone`)**
```javascript
module.exports = {
  // NO output: 'standalone' — Vercel handles deployment natively
  images: {
    remotePatterns: [
      { hostname: 'your-cloudfront-domain.cloudfront.net' },
      { hostname: 'your-s3-bucket.s3.ap-south-1.amazonaws.com' }
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['vaighaweaves.com'] }
  }
}
```

### **Cost Estimate (Current Scale)**

| Service | Plan | ~Monthly |
|---|---|---|
| Vercel | Hobby (free) | $0 |
| Railway (Medusa + Node) | Starter | ~$10–15 |
| Railway PostgreSQL | Managed | ~$5 |
| Railway Redis | Starter | ~$5 |
| Cloudflare | Free | $0 |
| AWS S3 + CloudFront | ~1,311 images | ~$2–5 |
| **Total** | | **~$22–30/month** |

### **Domain DNS Cutover Checklist**
- [ ] Lower HostGator DNS TTL to 300s (do 24h before cutover)
- [ ] Add domain to Cloudflare, verify all DNS records imported
- [ ] Change HostGator nameservers to Cloudflare NS addresses
- [ ] Verify MX records (email) are preserved in Cloudflare
- [ ] Add `vaighaweaves.com` + `www` in Vercel Domains settings
- [ ] Add `api.vaighaweaves.com` in Railway service networking
- [ ] Set Cloudflare SSL → Full (Strict)
- [ ] Test HTTPS on all three domains before promoting traffic

---

## 📚 Key Resources

### **Documentation**
- [Medusa.js Docs](https://docs.medusajs.com)
- [Medusa Architecture](https://docs.medusajs.com/learn/fundamentals/architecture)
- [Custom Modules](https://docs.medusajs.com/learn/customization/custom-features/module)
- [Event System](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers)

### **Internal Docs**
- [../docs/migration-progress.md](../docs/migration-progress.md) - Daily checklist
- [../docs/api-mapping.md](../docs/api-mapping.md) - Endpoint mapping (100+ endpoints)
- [../docs/GIT_BRANCHING_STRATEGY.md](../docs/GIT_BRANCHING_STRATEGY.md) - Git workflow
- [README.md](./README.md) - Quick start guide

### **Old System (Reference)**
- [../../vaighaweaves-server/](../../vaighaweaves-server/) - Old Express backend
- [../../vaighaweaves-ui/](../../vaighaweaves-ui/) - Old React frontend
- [../../CLAUDE.md](../../CLAUDE.md) - Old system documentation

---

## 🎯 Current Status

**Phase:** Phase 4 - Parallel Testing ✅ COMPLETE
**Previous:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅

**What was completed in Phase 1:**
- Module 1.1: Medusa backend initialized and running ✅
- Module 1.2: All 13 data migration scripts executed ✅ (7,631 ID mappings)
- Module 1.3: `stock-events` Medusa module built (TDD) ✅ — DB migration applied, 18 service unit tests
- Module 1.3b: PostgreSQL advisory locks ✅ — 9 locking tests (27 total)

**What was completed in Phase 2:**
- Part A: `product-metadata` module ✅ — 20 typed columns, defineLink to Product, 11 unit tests
- Part B: `image-optimizer` module ✅ — Sharp resize + S3 upload + WebP, 11 unit tests
- Image backfill ✅ — 3,530 variants created for 1,205/1,311 images (106 missing from S3)
- Admin + Store APIs, data migration scripts 14-16, 17/17 verification checks passed
- **49 total unit tests passing** (4 suites, ~1s)

**What was completed in Phase 3:**
- Part A: `payment-razorpay` ✅ — AbstractPaymentProvider (10 methods), auto/manual capture, webhook verification, 29 tests
- Part B: `webhook-monitor` ✅ — DLQ model + service, exponential backoff retries, health check cron (30 min), admin API, 10 tests
- Part C: `fulfillment-indian-carriers` ✅ — India Post BExT API client, Speed Post + Business Parcel, tariff calc, tracking sync, 18 tests
- Part D: Admin API (shipments list/create/detail/tracking) + 2 scheduled jobs
- Part E: medusa-config.ts updated, `Migration20260221072058` applied (webhook_event table)
- **106 total unit tests passing** (7 suites, clean exit, ~2s)

**What was completed in Phase 4:**
- Rewrote `compare-products.ts` — handle-based matching, slug dedup, normalized shapes → **5/5 PASS (95/95 matched, 100%)**
- Rewrote `compare-stock.ts` — per-product aggregation by handle, race condition test → **3/3 PASS (93/95, 97.9%)**
- Created `compare-orders.ts` — ID map validation, status distribution, orphan check → **4/4 PASS (864/864 exact)**
- Created `compare-payments.ts` — payment amounts, status distribution, revenue → **4/4 PASS (863/863 exact, Rs.7,270.64)**
- Created `load-test.yml` — Artillery config: 4 phases (warm-up → ramp-up → sustained → spike at 100 users/sec)
- Created shared utilities: `utils/normalize.ts`, `utils/auth.ts`, `utils/id-map.ts`, `utils/reporter.ts`
- 11 new files in `migration/testing/`, all compile with zero TypeScript errors
- **106 unit tests still passing** (7 suites, clean exit, ~2s)

**Developer:** Prudhvi (prudhviprabhatm.91@gmail.com)
**Approach:** Solo, backend-focused, AI-assisted (Claude Code / GitHub Copilot)
**Started:** February 16, 2026
**Phase 1 Completed:** February 20, 2026
**Phase 2 Completed:** February 20, 2026
**Phase 3 Completed:** February 21, 2026
**Phase 4 Completed:** February 22, 2026
**Next Phase:** Phase 5 — Cutover (Gradual Traffic Migration)

---

## 💡 Best Practices

### **Development Workflow**
1. **Always write tests first** (TDD)
2. **Commit frequently** (small, atomic commits)
3. **Run tests before pushing** (`npm run test:unit`)
4. **Keep main branch stable** (work on development/feature branches)
5. **Update migration-progress.md daily**

### **Code Quality**
- **ESLint**: Run `npm run lint` before commit
- **Prettier**: Auto-format on save
- **TypeScript**: Strict mode enabled (`skipLibCheck: true`)
- **Comments**: Document "why", not "what"
- **Naming**: Descriptive variable/function names

### **Module Development Pattern (Medusa v2)**
```typescript
// 1. Define model
const StockEvent = model.define("stock_event", { ... })

// 2. Extend MedusaService (auto-generates CRUD methods)
class StockEventModuleService extends MedusaService({ StockEvent }) {
  // 3. Add custom business logic on top of generated CRUD
  async reserveStock(variantId, qty, currentStock, opts) { ... }
}

// 4. Export module
export const STOCK_EVENTS_MODULE = "stockEvents"
export default Module(STOCK_EVENTS_MODULE, { service: StockEventModuleService })

// 5. Register in medusa-config.ts
modules: [{ resolve: "./src/modules/stock-events" }]

// 6. Resolve from container (API routes, subscribers)
const stockService = container.resolve(STOCK_EVENTS_MODULE)
```

### **Git Workflow**
```bash
# Feature development
git checkout development
git checkout -b feature/stock-management
# Work, commit, test
git checkout development
git merge feature/stock-management
git push origin development
```

### **Testing Strategy**
- Unit test: Every service method (mock MedusaService CRUD methods)
- Integration test: Every API endpoint (requires running Medusa)
- E2E test: Critical user journeys
- Performance test: Before production deploy

---

**Last Updated:** February 22, 2026
**Current Phase:** Phase 5 (Cutover) + Pre-Phase 6 (Wishlist module) in parallel
**Status:** Phases 0–4 all complete. 6 custom modules built, 106 unit tests passing. Phase 4 parallel testing: 4/4 scripts passing (100% products, 97.9% stock, 100% orders, 100% payments). Phase 6 plan fully resolved — all 8 gaps closed (admin strategy, auth, wishlist, Razorpay frontend, region routing, offline orders, sitemap, deployment). Ready to begin implementation.

**Phase 6 pre-work required before starting:**
1. Build wishlist Medusa module (Pre-Phase 6)
2. Register `@medusajs/payment-manual` + `@medusajs/fulfillment-manual` in medusa-config.ts
3. Build `reservation-to-order` workflow
4. Add Railway Redis service
5. Configure Cloudflare (can be done in parallel)
