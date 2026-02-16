# VaighaWeaves Migration

This folder contains all migration-related work for transitioning VaighaWeaves from Express + React to Medusa.js + Next.js.

## 📁 Folder Structure

```
migration/
├── vaighaweaves-medusa/     [NEXT STEP] New Medusa.js backend
├── vaighaweaves-nextjs/     [PHASE 6] New Next.js frontend (optional, later)
├── data-migration/          MySQL → PostgreSQL migration scripts
├── testing/                 Parallel API comparison tests
│   ├── package.json
│   ├── compare-products.ts
│   ├── compare-stock.ts
│   └── compare-orders.ts
└── README.md               ← You are here
```

## 🚀 Quick Start

### Step 1: Initialize Medusa Backend

```bash
cd migration/vaighaweaves-medusa
npx create-medusa-app@latest .

# Choose options:
# - PostgreSQL database
# - Create admin user
# - Seed database (optional)

npm install
```

### Step 2: Configure Environment

Create `.env` in `migration/vaighaweaves-medusa/`:

```env
NODE_ENV=development
PORT=9000
DATABASE_URL=postgresql://user:password@localhost:5432/vaighaweaves_new
JWT_SECRET=your_super_secret_32_character_minimum_jwt_key
COOKIE_SECRET=your_cookie_secret
ADMIN_CORS=http://localhost:3000,http://localhost:3001,http://localhost:9000
STORE_CORS=http://localhost:3000,http://localhost:3001

# AWS S3 (same as old system)
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Razorpay (same as old system)
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

### Step 3: Run Migrations

```bash
cd migration/vaighaweaves-medusa
npm run migrations
```

### Step 4: Start Medusa

```bash
npm run dev
# Backend: http://localhost:9000
# Admin:   http://localhost:9000/app
```

### Step 5: Data Migration

```bash
cd migration/data-migration
npm install
npm run migrate:all
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

- **Week 0 (Feb 16-17):** ✅ Phase 0 - Setup complete
- **Week 1-2 (Feb 18-Mar 3):** Phase 1 - Core infrastructure + stock management
- **Week 3 (Mar 4-10):** Phase 2 - Product catalog
- **Week 4 (Mar 11-17):** Phase 3 - Orders & payments
- **Week 5 (Mar 18-24):** Phase 4 - Parallel testing
- **Week 6 (Mar 25-31):** Phase 5 - Cutover
- **Week 7+ (Apr 1+):** Phase 6 - Next.js migration (optional)

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
