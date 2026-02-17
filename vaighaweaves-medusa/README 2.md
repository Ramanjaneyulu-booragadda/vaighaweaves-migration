# VaighaWeaves Medusa Backend

New Medusa.js backend for VaighaWeaves e-commerce platform.

---

## 🚀 Quick Start

**First time setup:**
```bash
# Follow the detailed setup guide
cat SETUP.md
```

**After setup:**
```bash
npm run dev
# Backend:  http://localhost:9000
# Admin:    http://localhost:9000/app
```

---

## 📁 Project Structure

```
vaighaweaves-medusa/
├── src/
│   ├── api/              Custom API endpoints
│   │   ├── admin/        Admin-only endpoints
│   │   ├── store/        Customer-facing endpoints
│   │   └── middlewares/  Custom middleware
│   │
│   ├── services/         Business logic services
│   │   └── stock-event.service.ts (Phase 1.3 - to be created)
│   │
│   ├── subscribers/      Event listeners
│   │   └── order-placed.subscriber.ts (Phase 1.3)
│   │
│   ├── repositories/     Data access layer
│   │   └── stock-event.repository.ts (Phase 1.3)
│   │
│   ├── models/           Database models
│   │   └── stock-event.ts (Phase 1.3)
│   │
│   ├── plugins/          Custom Medusa plugins
│   │   ├── stock-events/           (Phase 1 - P0 Critical)
│   │   ├── payment-razorpay/       (Phase 3 - P0 Critical)
│   │   ├── image-optimizer/        (Phase 2 - P1 High)
│   │   ├── fulfillment-indian/     (Phase 4 - P1 High)
│   │   ├── gst-tax/                (Phase 4 - P1 High)
│   │   ├── analytics/              (Phase 5 - P2 Medium)
│   │   ├── wishlist/               (Phase 5 - P2 Medium)
│   │   └── reviews/                (Phase 5 - P2 Medium)
│   │
│   └── migrations/       Database migrations
│
├── medusa-config.js      Medusa configuration
├── package.json          Dependencies & scripts
├── .env                  Environment variables (local, not committed)
├── .env.example          Example environment file
├── .gitignore            Git ignore rules
├── tsconfig.json         TypeScript configuration
├── SETUP.md              Setup instructions
└── README.md             ← You are here
```

---

## 🎯 What This Replaces

**Old System (Express):**
- `vaighaweaves-server/src/controllers/` → Medusa built-in + `src/api/`
- `vaighaweaves-server/src/services/` → Medusa built-in + `src/services/`
- `vaighaweaves-server/src/repositories/` → Medusa built-in + `src/repositories/`
- `vaighaweaves-server/prisma/` → Medusa TypeORM + PostgreSQL

**Key Improvements:**
- ✅ Single source of truth for stock (no dual-stock bug)
- ✅ Event-sourced architecture (audit trail)
- ✅ Built-in admin panel (no custom admin needed)
- ✅ Better separation of concerns
- ✅ Webhook monitoring (Razorpay auto-recovery)

---

## 📝 Development Workflow

### Day-to-Day Commands
```bash
# Start development server (hot reload)
npm run dev

# Run tests (once we add them)
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run build

# Lint code
npm run lint
```

### Database Commands
```bash
# Run pending migrations
npm run migrations

# Create new migration
npx medusa migrations create MigrationName

# Rollback last migration
npx medusa migrations revert

# Reset database (DANGER!)
dropdb vaighaweaves_medusa && createdb vaighaweaves_medusa
npm run migrations
```

### Adding Custom Code

#### 1. Custom API Endpoint
```bash
# Create file: src/api/admin/custom-endpoint.ts
import { Request, Response } from "express"

export default async (req: Request, res: Response) => {
  res.json({ message: "Custom endpoint" })
}

# Router automatically picks it up
# Available at: POST /admin/custom-endpoint
```

#### 2. Custom Service
```bash
# Create file: src/services/my-service.ts
import { TransactionBaseService } from "@medusajs/medusa"

class MyService extends TransactionBaseService {
  async doSomething() {
    // Business logic here
  }
}

export default MyService
```

#### 3. Event Subscriber
```bash
# Create file: src/subscribers/my-subscriber.ts
class MySubscriber {
  constructor({ eventBusService }) {
    eventBusService.subscribe("order.placed", this.handleOrderPlaced)
  }

  handleOrderPlaced = async (data) => {
    // React to order placement
  }
}

export default MySubscriber
```

---

## 🧪 Testing Strategy

### Test Structure (To be added in Phase 1.3)
```
vaighaweaves-medusa/
├── src/
│   └── services/
│       └── stock-event.service.ts
└── tests/
    ├── unit/
    │   └── stock-event.service.spec.ts
    ├── integration/
    │   └── stock-api.spec.ts
    └── e2e/
        └── checkout-flow.spec.ts
```

### Running Tests
```bash
# Unit tests (fast)
npm run test:unit

# Integration tests (medium)
npm run test:integration

# E2E tests (slow)
npm run test:e2e

# All tests
npm test

# Coverage report
npm run test:coverage
# Must be > 80%
```

---

## 🔌 Custom Plugins

### Phase 1: Stock Events (P0 - Critical)
**Location:** `src/plugins/stock-events/`

**Purpose:** Event-sourced stock management to fix dual-stock sync bug

**Features:**
- Append-only stock event log
- PostgreSQL advisory locks (prevent race conditions)
- Admin UI for stock history
- Automatic stock reservation on order

**Estimated:** ~400 lines, 3 days

### Phase 3: Razorpay Enhanced (P0 - Critical)
**Location:** `src/plugins/payment-razorpay/`

**Purpose:** Webhook monitoring + auto-recovery

**Features:**
- Health check cron (every 30 min)
- Auto re-registration if webhook disabled
- Idempotency handling
- Dead letter queue for failed webhooks

**Estimated:** ~500 lines, 3 days

### Phase 2-4: Other Plugins (P1-P2)
See `../CLAUDE.md` for full plugin list.

---

## 🚨 Important Notes

### Environment Variables
- ✅ **NEVER commit `.env`** to Git (it's in .gitignore)
- ✅ Always update `.env.example` when adding new vars
- ✅ Use different .env files for dev/staging/production
- ✅ Generate strong random values for secrets

### Database
- ✅ Use PostgreSQL (not MySQL)
- ✅ Run migrations before starting server
- ✅ Back up database before running destructive operations
- ✅ Test migrations on staging before production

### Code Quality
- ✅ Write tests FIRST (TDD approach)
- ✅ Aim for 80%+ test coverage
- ✅ Run `npm run lint` before committing
- ✅ Use TypeScript strict mode
- ✅ Comment "why", not "what"

### Git Workflow
- ✅ Work on `development` branch
- ✅ Create feature branches: `feature/stock-management`
- ✅ Commit frequently (small, atomic commits)
- ✅ Run tests before pushing
- ✅ Merge to `development`, not `main`

---

## 📚 Documentation

- [Medusa.js Docs](https://docs.medusajs.com)
- [Medusa Architecture](https://docs.medusajs.com/learn/fundamentals/architecture)
- [Custom Plugins](https://docs.medusajs.com/learn/customization/custom-features/module)
- [Event System](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers)
- [Migration Guide](../CLAUDE.md) - Our migration context
- [Setup Guide](./SETUP.md) - Initial setup instructions

---

## 🎯 Current Status

**Phase:** Phase 1 - Core Infrastructure
**Module:** 1.1 - Medusa Setup
**Status:** Ready to initialize
**Next:** Run `npx create-medusa-app@latest` (see SETUP.md)

---

**Last Updated:** February 17, 2026
**Developer:** Prudhvi
**Port:** 9000 (backend), 9000/app (admin)
