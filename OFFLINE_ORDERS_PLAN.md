# Offline/In-Store Orders Migration Plan

**Date:** February 17, 2026
**Status:** ✅ Requirements Confirmed

---

## 📋 User Confirmed Requirements

| Requirement | Answer |
|-------------|--------|
| Keep StockReservation system? | ✅ **YES** |
| Reservation hold durations | 15min, 30min, 1hr, 4hr, 24hr |
| Walk-in customers get accounts? | ❌ **NO** (guest orders only) |
| Guest orders format | ✅ Name + Phone only |
| Offline order volume | **High** (decent number) |

---

## 🏪 Two Main Offline Flows

### Flow 1: Phone Reservation → Walk-in Purchase
```
Customer calls
    ↓
Admin creates StockReservation
  - customerName: "Priya"
  - customerPhone: "+91 98765..."
  - expiresAt: [15min/30min/1hr/4hr/24hr]
  - status: ACTIVE
    ↓
Customer shows up within time
    ↓
Admin creates Order
  - isOfflinePayment: true
  - offlinePaymentRef: "CASH-001"
  - Links reservation
    ↓
StockReservation.status: ACTIVE → CONVERTED
Stock deducted
Order complete ✅

OR: Customer doesn't show
    ↓
Cron checks expiresAt
StockReservation.status: ACTIVE → EXPIRED
Stock released ✅
```

### Flow 2: Walk-in Purchase (No Reservation)
```
Customer walks in
    ↓
Browsing + Selection
    ↓
Admin creates Order directly
  - isOfflinePayment: true
  - offlinePaymentRef: "CARD-TERMINAL-5"
  - guestCustomerName: "Priya"
  - guestCustomerPhone: "+91 98765..."
    ↓
Stock deducted immediately
Receipt printed
Pickup (no shipping) ✅
```

---

## 🗄️ Database Mapping

### StockReservation
```
OLD → NEW

reservedBy (Admin ID)
  └─> staff_id (Medusa Admin)

reservedFor (Customer ID or NULL)
  └─> customer_id (Medusa Customer or NULL)

customerName
  └─> customer_name (preserved)

customerPhone
  └─> customer_phone (preserved)

expiresAt
  └─> expires_at (for auto-expiry cron)

status: ACTIVE|EXPIRED|CONVERTED|CANCELLED
  └─> status (same enum)

metadata (new)
  └─> expiryDuration: "15min"|"30min"|"1hr"|"4hr"|"24hr"
  └─> oldReservationId: 123
```

### Offline Orders
```
OLD → NEW

isOfflinePayment: true
  └─> metadata.isOfflinePayment: true

processedByAdminId: 456
  └─> metadata.processedByStaffId: UUID

offlinePaymentRef: "CASH-001"
  └─> metadata.offlinePaymentRef

offlinePaymentNote: "Gave 10% discount"
  └─> metadata.offlinePaymentNote

(Guest customer handling)
  └─> Create guest Customer profile
      └─> email: "guest-{hash}@vaighaweaves.local"
      └─> name: from order
      └─> phone: from order
      └─> metadata.isGuestCustomer: true
```

---

## 🔄 Migration Scripts Affected

### Script 08 (UPDATED): `08-migrate-orders.ts`
**Changes:**
- Identify offline orders (`isOfflinePayment = true`)
- Create guest Customer profiles for walk-ins (no existing userId)
- Preserve offline payment references in `Order.metadata`
- Track which admin processed the order
- Handle NULL customer for guest orders

**Lines:** 500 (increased from 400)

### Script 13 (NEW): `13-migrate-stock-reservations.ts`
**Purpose:**
- Migrate `StockReservation` table to Medusa
- Preserve reservation history (ACTIVE, EXPIRED, CONVERTED, CANCELLED statuses)
- Link to ProductVariant via ID mapping
- Create background jobs for auto-expiry

**Key Features:**
- Parse expiryDuration from `expiresAt` calculation
- Handle expired reservations (if any)
- Link converted reservations to their Orders
- Preserve customer details for analytics

**Lines:** 200

---

## 🎯 Implementation Strategy

### Phase 1.2 Scripts Order:
```
01-setup-medusa-schema.ts          ← ID mapping table
02-migrate-categories.ts            ← Categories (simple)
03-migrate-products.ts              ← Products
04-migrate-images.ts                ← Images
05-migrate-variants-and-stock.ts    ← CRITICAL: Stock consolidation
06-migrate-users.ts                 ← Admin + Customer users
07-migrate-addresses.ts             ← Addresses
08-migrate-orders.ts ⭐ UPDATED     ← NOW: Handle offline + guest orders
09-migrate-payments.ts              ← Razorpay payments
10-migrate-stock-events.ts          ← Stock event audit trail
11-migrate-shipments.ts             ← Shipping
12-verify-migration.ts              ← Data parity check
13-migrate-stock-reservations.ts ⭐ NEW  ← Phone reservations
```

---

## ✅ Success Criteria

1. **All offline orders migrated**
   - Count matches: `SELECT COUNT(*) WHERE isOfflinePayment = true`

2. **All reservations preserved**
   - Count matches: `SELECT COUNT(*) FROM stock_reservation`

3. **Guest customers created**
   - Phone + name preserved
   - Linked to offline orders

4. **Stock amounts accurate**
   - Total stock pre/post migration matches

5. **No data loss**
   - All offlinePaymentRef preserved
   - All admin processors tracked

---

## 🚨 Special Considerations

### Expiry Duration Calculation
```typescript
// OLD: expiresAt is absolute DateTime
// NEW: Need to store duration type for business logic

expiresAt: 2026-02-17 15:30:00 (Database)
// How to detect if it was 15min vs 1hr vs 24hr?

// Solution: Calculate from createdAt + expiresAt difference
duration = expiresAt - createdAt

if (duration <= 15 minutes) { durationStr = "15min" }
else if (duration <= 30 minutes) { durationStr = "30min" }
else if (duration <= 1 hour) { durationStr = "1hr" }
else if (duration <= 4 hours) { durationStr = "4hr" }
else { durationStr = "24hr" }

Store in metadata.expiryDuration
```

### Guest Customer Email
```typescript
// Walk-in customers don't have emails
// But Medusa requires email field

// Solution: Generate synthetic email from phone hash

function generateGuestEmail(phone: string): string {
  const hash = md5(phone).substring(0, 8)
  return `guest-${hash}@vaighaweaves.local`
}

// Example: "+91 98765 43210" → "guest-a7f2d1c3@vaighaweaves.local"
```

---

## 📅 Timeline Impact

Adding offline orders handling increases migration by ~1-2 hours:
- Script 08 expansion: +100 lines
- Script 13 creation: +200 lines
- Testing: +30 minutes

**New Total:** ~20-30 minutes execution + 1 hour testing

---

## ✨ Benefits After Migration

1. **Better Reservation Tracking**
   - Can see which reservations converted to orders
   - Track walk-in customer patterns

2. **Multi-channel Support**
   - Online + offline orders in single system
   - Unified inventory

3. **SMS/Email to Walk-ins**
   - Medusa can send notifications to guest customers
   - No offline-only blind spot

4. **Analytics**
   - Can track offline vs online revenue split
   - Walk-in customer metrics

---

**Status:** Ready to begin scripts ✅
**Next Step:** Start with Script 01 (Setup & ID mapping)
