# VaighaWeaves Migration

This folder contains all migration-related work for transitioning VaighaWeaves from Express + React to Medusa.js + Next.js.

> **Status (Feb 18, 2026):** Data migration phase **complete** — all 13 scripts ran successfully.
> Next: build custom plugins and verify Medusa API serves the migrated data.

## 📁 Folder Structure

```
migration/
├── vaighaweaves-medusa/     New Medusa.js backend (Phases 1–5)
├── vaighaweaves-nextjs/     New Next.js frontend (Phase 6 — optional)
├── data-migration/          MySQL → PostgreSQL scripts ✅ ALL COMPLETE
│   ├── 01-setup-schema.ts
├──  02-migrate-categories.ts   ✅ 92 records
├──  03-migrate-products.ts     ✅ 117 records
├──  04-migrate-images.ts       ✅ 1,311 records
├──  05-migrate-variants-stock.ts ✅ 127 variants
├──  06-migrate-users.ts        ✅ 2,573 users
├──  07-migrate-addresses.ts    ✅ 610 records
├──  08-migrate-orders.ts       ✅ 864 orders, 1,205 items
├──  09-migrate-payments.ts     ✅ 863 records
├──  10-migrate-stock-events.ts ✅ 36 records
├──  11-migrate-shipments.ts    ✅ 0 (source empty)
├──  12-verify-migration.ts     ✅ All checks passed
└──  13-migrate-stock-reservations.ts ✅ 1,049 records
├── testing/                 Parallel API comparison tests
│   ├── compare-products.ts
│   ├── compare-stock.ts
│   └── compare-orders.ts
└── README.md               ← You are here
```

## 🚀 Quick Start

### ✅ Step 1–5 — Data Migration (DONE)

All MySQL → PostgreSQL migration scripts have been run. The target database `vaighaweaves_db_dev` on `localhost:5432` is fully populated.

To re-run any individual script:
```bash
cd migration/data-migration
npm run script:08   # e.g. re-run orders
npm run script:12   # re-run verification at any time
```

To run the full pipeline from scratch:
```bash
cd migration/data-migration
npm run migrate:all
```

### Step 6: Start Medusa Backend

```bash
cd migration/vaighaweaves-medusa
npm run dev
# Backend: http://localhost:9000
# Admin:   http://localhost:9000/app
```

### Step 7: Verify API Serves Migrated Data

```bash
# Check products are visible
curl http://localhost:9000/store/products | jq '.count'

# Check admin panel
open http://localhost:9000/app
```

## 📊 Testing Strategy

### Phase 4: Parallel Testing (Week 4)

Run both old and new systems simultaneously:

```bash
# Terminal 1: Start both systems
cd ../..  # Back to root
./scripts/start-parallel.sh

# Terminal 2: Run comparison tests
cd migration/testing
npm install
npm run test:compare-products  # Compare product APIs
npm run test:compare-stock     # Verify stock levels
npm run test:compare-orders    # Compare order data
npm run test:load              # Load testing (Artillery)
```

### Test Results

Results are saved to `migration/testing/results/` with timestamps:
- `product-comparison-YYYY-MM-DD.json`
- `stock-comparison-YYYY-MM-DD.json`
- `order-comparison-YYYY-MM-DD.json`

## 📝 Documentation

All migration documentation is in `docs/`:

- **[migration-progress.md](../docs/migration-progress.md)** - Daily progress tracker with TDD checklist
- **[api-mapping.md](../docs/api-mapping.md)** - Complete Express → Medusa endpoint mapping
- **[GIT_BRANCHING_STRATEGY.md](../docs/GIT_BRANCHING_STRATEGY.md)** - Git workflow and branching
- **[blueprints/](../docs/blueprints/)** - Architecture blueprints (4 HTML files)

## 🏗️ Custom Plugins to Build

### Phase 1 (Week 1-2): Critical
1. **medusa-plugin-stock-events** (~400 lines)
   - Event-sourced stock management
   - Fixes dual-stock sync bug
   - PostgreSQL advisory locks

### Phase 3 (Week 4): Critical
2. **medusa-payment-razorpay-enhanced** (~500 lines)
   - Webhook health monitoring
   - Auto re-registration
   - Idempotency + dead letter queue

### Phase 2-4 (Week 3-5): High Priority
3. **medusa-plugin-image-optimizer** (~300 lines)
4. **medusa-fulfillment-indian-carriers** (~500 lines)
5. **medusa-plugin-gst-tax** (~400 lines)

### Phase 5+ (Week 6+): Medium Priority
6. **medusa-plugin-analytics** (~300 lines)
7. **medusa-plugin-wishlist** (~200 lines)
8. **medusa-plugin-reviews** (~250 lines)

## 🔧 Common Commands

```bash
# Check migration progress
cat ../docs/migration-progress.md

# View API mapping
cat ../docs/api-mapping.md

# Start old system only
cd ../..
./scripts/start-old.sh

# Start new system only
./scripts/start-new.sh

# Start both for testing
./scripts/start-parallel.sh

# Stop all processes
./scripts/stop-all.sh

# Run specific comparison test
cd migration/testing
npm run test:compare-products
npm run test:compare-stock
npm run test:compare-orders

# Run all tests
npm run test:all
```

## 📅 Timeline

| Phase | Dates | Status |
|-------|-------|--------|
| Phase 0 — Setup | Feb 16–17 | ✅ Complete |
| Phase 1.1 — Medusa setup | Feb 17 | ✅ Complete |
| Phase 1.2 — Data migration (scripts 01–13) | Feb 18 | ✅ Complete |
| Phase 1.3 — Stock management plugin | Feb 18+ | 🔄 **Current** |
| Phase 2 — Product catalog polish | Mar 4–10 | 🕒 Pending |
| Phase 3 — Orders & payments | Mar 11–17 | 🕒 Pending |
| Phase 4 — Parallel testing | Mar 18–24 | 🕒 Pending |
| Phase 5 — Cutover | Mar 25–31 | 🕒 Pending |
| Phase 6 — Next.js migration (optional) | Apr 1+ | 🕒 Optional |

## ✅ Success Criteria

### Backend Migration (Phase 1-5)
- ✅ Stock sync bugs eliminated (zero discrepancies)
- ✅ Razorpay webhooks 99.9% uptime (no manual re-registration for 1 month)
- ✅ Admin product upload < 30 seconds (vs 2 minutes old)
- ✅ API response time improved 30%+
- ✅ Test coverage > 80%
- ✅ Zero production incidents for 2 weeks post-cutover

### Business Impact
- ✅ Customer complaints reduced 50%+
- ✅ Admin time saved 2+ hours/day
- ✅ Revenue loss from overselling eliminated
- ✅ Server costs reduced 20%+

## 🚨 Rollback Plan

If critical issues occur during cutover (Phase 5):

```bash
# Immediate rollback (< 5 minutes)
cd vaighaweaves-ui
echo "VITE_API_URL=http://localhost:5001/api" > .env.production
npm run build
vercel --prod

# Old system continues serving traffic
# New system kept running for debugging
```

**Rollback Triggers:**
- ❌ Error rate > 1%
- ❌ Stock overselling detected
- ❌ Payment failures > 5%
- ❌ Customer complaints spike

## 📞 Support

**Developer:** Prudhvi (prudhviprabhatm.91@gmail.com)
**Approach:** Solo developer with AI assistance (Claude Code)
**Strategy:** Backend-first, TDD, zero-downtime migration

## 🔗 Resources

- [Medusa.js Documentation](https://docs.medusajs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Next Step:** Initialize Medusa project in `vaighaweaves-medusa/` (Feb 17, 2026)
**Status:** Phase 0 Setup Complete ✅
**Last Updated:** February 16, 2026
