# Medusa Backend Setup Guide

Follow these steps to initialize the Medusa.js backend for VaighaWeaves.

---

## Prerequisites

Ensure you have installed:
- ✅ **Node.js 18+** (`node --version`)
- ✅ **PostgreSQL 14+** (`psql --version`)
- ✅ **npm or yarn** (`npm --version`)

---

## Step 1: Initialize Medusa Project (5 minutes)

```bash
cd ~/vaighaweaves/migration/vaighaweaves-medusa

# Option A: Interactive setup (Recommended)
npx create-medusa-app@latest

# When prompted:
# - Project directory: . (current directory)
# - Database type: PostgreSQL
# - Database URL: postgresql://username:password@localhost:5432/vaighaweaves_medusa
# - Create admin user? Yes
# - Admin email: prudhviprabhatm.91@gmail.com
# - Admin password: [create a strong password]
# - Seed database? No (we'll migrate from old system)

# Option B: Non-interactive (if you prefer)
npx create-medusa-app@latest \
  --db-url postgresql://username:password@localhost:5432/vaighaweaves_db_dev \
  --skip-db \
  --skip-env
```

---

## Step 2: Create PostgreSQL Database (2 minutes)

```bash
# Create database
createdb vaighaweaves_db_dev

# Verify it was created
psql -l | grep vaighaweaves_db_dev

# Optional: Connect to database
psql vaighaweaves_db_dev
# \dt  -- list tables (should be empty for now)
# \q   -- quit
```

---

## Step 3: Configure Environment Variables (3 minutes)

```bash
# Copy example env file
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor (vim, code, etc.)
```

**Required fields to update:**
```env
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/vaighaweaves_medusa
JWT_SECRET=<generate using command below>
COOKIE_SECRET=<generate using command below>
AWS_S3_BUCKET=<copy from ../../vaighaweaves-server/.env>
AWS_ACCESS_KEY_ID=<copy from old .env>
AWS_SECRET_ACCESS_KEY=<copy from old .env>
RAZORPAY_KEY_ID=<copy from old .env>
RAZORPAY_KEY_SECRET=<copy from old .env>
```

**Generate secrets:**
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate COOKIE_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4: Install Dependencies (2 minutes)

```bash
npm install

# If you get dependency conflicts
npm install --legacy-peer-deps
```

---

## Step 5: Run Database Migrations (1 minute)

```bash
# This creates all Medusa core tables
npm run migrations

# Verify tables were created
psql vaighaweaves_db_dev -c "\dt"
# Should see tables: product, order, customer, cart, etc.
```

---

## Step 6: Create Admin User (1 minute)

```bash
# Create admin user via Medusa CLI
npx medusa user --email prudhviprabhatm.91@gmail.com --password Oldisgold@2026

# Or via SQL (if CLI doesn't work)
psql vaighaweaves_db_dev

INSERT INTO "user" (email, password_hash, role)
VALUES ('prudhviprabhatm.91@gmail.com', crypt('Oldisgold@2026', gen_salt('bf')), 'admin');
```

---

## Step 7: Start Medusa Backend (1 minute)

```bash
npm run dev

# Should see:
# Server is ready on port: 9000
# Admin dashboard: http://localhost:9000/app
```

**Open in browser:**
- Backend API: http://localhost:9000
- Admin Dashboard: http://localhost:9000/app
- Health check: http://localhost:9000/health

**Login to Admin:**
- Email: prudhviprabhatm.91@gmail.com
- Password: Oldisgold@2026

---

## Step 8: Verify Installation (2 minutes)

### Test 1: Health Check
```bash
curl http://localhost:9000/health
# Should return: {"status":"ok"}
```

### Test 2: Admin API
```bash
curl http://localhost:9000/admin/users/me \
  -H "Authorization: Bearer <your-admin-token>"
# Should return your user object
```

### Test 3: Store API
```bash
curl http://localhost:9000/store/products
# Should return empty array (no products yet)
```

---

## Troubleshooting

### Issue: "Cannot connect to database"
```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -l | grep vaighaweaves_medusa

# Check DATABASE_URL in .env is correct
cat .env | grep DATABASE_URL
```

### Issue: "Port 9000 already in use"
```bash
# Find process using port 9000
lsof -ti:9000

# Kill the process
kill -9 $(lsof -ti:9000)

# Or change PORT in .env
echo "PORT=9001" >> .env
```

### Issue: "npm run dev fails"
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version (must be 18+)
node --version
```

### Issue: "Cannot create admin user"
```bash
# Check user table exists
psql vaighaweaves_medusa -c "SELECT * FROM \"user\";"

# Manually insert via SQL (see Step 6)
```

---

## Next Steps

Once Medusa is running:

1. **Explore Admin Dashboard**
   - Navigate to http://localhost:9000/app
   - Familiarize yourself with the UI
   - Try creating a test product manually

2. **Test API Endpoints**
   ```bash
   # Get all products
   curl http://localhost:9000/store/products

   # Get all collections
   curl http://localhost:9000/store/collections
   ```

3. **Move to Phase 1.2: Data Migration**
   - See `../data-migration/README.md`
   - Migrate products from MySQL → PostgreSQL

4. **Start Building Stock Plugin** (Phase 1.3)
   - See `../CLAUDE.md` for architecture
   - Follow TDD approach (tests first!)

---

## Useful Commands

```bash
# Start development server
npm run dev

# Start production server
npm run start

# Run migrations
npm run migrations

# Rollback last migration
npx medusa migrations revert

# Generate TypeScript types
npm run build

# Run tests (once we add them)
npm test

# Lint code
npm run lint

# Format code
npm run format
```

---

## Project Structure (After Setup)

```
vaighaweaves-medusa/
├── src/
│   ├── api/              Custom API endpoints (we'll add here)
│   ├── services/         Custom services (we'll add here)
│   ├── subscribers/      Event subscribers (we'll add here)
│   ├── repositories/     Data access (we'll add here)
│   └── plugins/          Custom plugins (we'll add here)
├── medusa-config.js      Medusa configuration
├── package.json
├── .env                  Environment variables (DON'T COMMIT!)
├── .env.example          Example env file (safe to commit)
├── tsconfig.json         TypeScript configuration
└── SETUP.md              ← You are here
```

---

## Documentation

- [Medusa Documentation](https://docs.medusajs.com)
- [Medusa GitHub](https://github.com/medusajs/medusa)
- [Migration CLAUDE.md](../CLAUDE.md) - Our migration context
- [API Mapping](../../docs/api-mapping.md) - Express → Medusa endpoints

---

**Status:** ⏳ Awaiting Medusa initialization
**Time Required:** ~15 minutes total
**Next:** Data migration (Phase 1.2)
