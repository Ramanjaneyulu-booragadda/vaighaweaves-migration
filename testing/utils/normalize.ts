/**
 * Shared normalization functions for comparing API responses
 * between old Express system and new Medusa system.
 *
 * Both systems return different response shapes. These functions
 * map them to a common interface for comparison.
 */

// ── Normalized Interfaces ──────────────────────────────────────────────

export interface NormalizedProduct {
  title: string
  handle: string
  status: string
  description: string
  categories: string[]
  imageCount: number
  variantCount: number
  weight: string | null
}

export interface NormalizedOrder {
  displayId: string
  status: string
  total: number
  currency: string
  itemCount: number
  customerEmail: string
  createdAt: string
}

export interface NormalizedPayment {
  orderId: string
  amount: number
  status: string
  provider: string
  transactionId: string
}

// ── Product Normalization ──────────────────────────────────────────────

export function normalizeProduct(
  source: "express" | "medusa",
  raw: any
): NormalizedProduct {
  if (source === "express") {
    return {
      title: raw.name || raw.title || "",
      handle: raw.slug || raw.handle || "",
      status: raw.isActive ? "published" : "draft",
      description: raw.description || "",
      categories: Array.isArray(raw.categories)
        ? raw.categories.map((c: any) => c.name || c)
        : raw.category
          ? [raw.category.name || raw.category]
          : [],
      imageCount: Array.isArray(raw.images) ? raw.images.length : 0,
      variantCount: Array.isArray(raw.variants)
        ? raw.variants.length
        : Array.isArray(raw.images)
          ? raw.images.length
          : 0,
      weight: raw.weight != null ? String(raw.weight) : null,
    }
  }

  // Medusa format
  return {
    title: raw.title || "",
    handle: raw.handle || "",
    status: raw.status || "draft",
    description: raw.description || "",
    categories: Array.isArray(raw.categories)
      ? raw.categories.map((c: any) => c.name || c)
      : [],
    imageCount: Array.isArray(raw.images) ? raw.images.length : 0,
    variantCount: Array.isArray(raw.variants) ? raw.variants.length : 0,
    weight: raw.weight != null ? String(raw.weight) : null,
  }
}

// ── Order Normalization ────────────────────────────────────────────────

const EXPRESS_STATUS_MAP: Record<string, string> = {
  PENDING: "pending",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  COMPLETED: "delivered",
  REFUNDED: "refunded",
}

const MEDUSA_STATUS_MAP: Record<string, string> = {
  pending: "pending",
  completed: "delivered",
  canceled: "cancelled",
  requires_action: "processing",
  archived: "delivered",
}

export function normalizeOrder(
  source: "express" | "medusa",
  raw: any
): NormalizedOrder {
  if (source === "express") {
    return {
      displayId: raw.orderNumber || raw.displayId || String(raw.id),
      status: EXPRESS_STATUS_MAP[raw.status] || raw.status?.toLowerCase() || "unknown",
      total: Math.round((raw.totalAmount || raw.total || 0) * 100),
      currency: (raw.currency || "INR").toUpperCase(),
      itemCount: Array.isArray(raw.items) ? raw.items.length : (raw.itemCount || 0),
      customerEmail: raw.user?.email || raw.customerEmail || "",
      createdAt: raw.createdAt || raw.created_at || "",
    }
  }

  // Medusa format
  return {
    displayId: raw.display_id ? String(raw.display_id) : raw.id || "",
    status: MEDUSA_STATUS_MAP[raw.status] || raw.status || "unknown",
    total: raw.total || 0,
    currency: (raw.currency_code || "INR").toUpperCase(),
    itemCount: Array.isArray(raw.items) ? raw.items.length : 0,
    customerEmail: raw.customer?.email || raw.email || "",
    createdAt: raw.created_at || "",
  }
}

// ── Payment Normalization ──────────────────────────────────────────────

const EXPRESS_PAYMENT_STATUS_MAP: Record<string, string> = {
  PENDING: "pending",
  COMPLETED: "completed",
  CAPTURED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
}

// Medusa payment_collection.status values (not payment-level status)
const MEDUSA_PAYMENT_STATUS_MAP: Record<string, string> = {
  completed: "completed",
  captured: "completed",
  authorized: "pending",
  pending: "pending",
  canceled: "cancelled",
  requires_more: "pending",
  not_paid: "pending",
  refunded: "refunded",
}

export function normalizePayment(
  source: "express" | "medusa",
  raw: any
): NormalizedPayment {
  if (source === "express") {
    return {
      orderId: String(raw.orderId || raw.order_id || ""),
      amount: Math.round((raw.amount || 0) * 100),
      status: EXPRESS_PAYMENT_STATUS_MAP[raw.status] || raw.status?.toLowerCase() || "unknown",
      provider: raw.provider || raw.paymentMethod || "razorpay",
      transactionId: raw.transactionId || raw.razorpayPaymentId || "",
    }
  }

  // Medusa format: status from payment_collection.status
  // transactionId stored in payment_collection.metadata by migration script 09
  const col = raw.payment_collection || {}
  const meta = col.metadata || {}
  const collectionStatus = col.status || raw.status || ""
  return {
    orderId: String(raw.payment_collection_id || ""),
    amount: raw.amount || 0,
    status: MEDUSA_PAYMENT_STATUS_MAP[collectionStatus] || collectionStatus || "unknown",
    provider: raw.provider_id || meta.paymentGateway || "razorpay",
    transactionId: meta.transactionId || raw.data?.transactionId || "",
  }
}
