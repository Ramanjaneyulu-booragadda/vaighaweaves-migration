/**
 * Unit tests for WebhookMonitorModuleService
 *
 * Tests the DLQ logic: queueing, retry, markProcessed, markDeadLetter,
 * health status, and exponential backoff.
 */

import { MedusaService } from "@medusajs/framework/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Mock MedusaService to provide CRUD stubs
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("@medusajs/framework/utils", () => ({
  MedusaService: jest.fn().mockImplementation(() => {
    return class {}
  }),
  model: {
    define: jest.fn().mockReturnValue({}),
    id: jest.fn().mockReturnValue({ primaryKey: jest.fn().mockReturnValue({}) }),
    text: jest.fn().mockReturnValue({
      nullable: jest.fn().mockReturnValue({}),
      default: jest.fn().mockReturnValue({}),
    }),
    number: jest.fn().mockReturnValue({ default: jest.fn().mockReturnValue({}) }),
    dateTime: jest.fn().mockReturnValue({ nullable: jest.fn().mockReturnValue({}) }),
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import service (after mocks)
// ─────────────────────────────────────────────────────────────────────────────

import WebhookMonitorModuleService from "../service"

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

// Add mock CRUD methods that MedusaService normally generates
function createService() {
  const svc = new WebhookMonitorModuleService()

  // In-memory store for webhook events
  const store: Record<string, any>[] = []
  let idCounter = 1

  svc.createWebhookEvents = jest.fn().mockImplementation((data) => {
    const record = { id: `wh_${idCounter++}`, ...data }
    store.push(record)
    return record
  })

  svc.updateWebhookEvents = jest.fn().mockImplementation((data) => {
    const idx = store.findIndex((e) => e.id === data.id)
    if (idx >= 0) {
      store[idx] = { ...store[idx], ...data }
      return store[idx]
    }
    return data
  })

  svc.listWebhookEvents = jest.fn().mockImplementation(({ filters } = {}) => {
    if (!filters) return [...store]
    return store.filter((e) => {
      for (const [key, val] of Object.entries(filters)) {
        if (Array.isArray(val)) {
          if (!val.includes(e[key])) return false
        } else if (e[key] !== val) {
          return false
        }
      }
      return true
    })
  })

  return { service: svc, store }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("WebhookMonitorModuleService", () => {
  describe("queueWebhookRetry", () => {
    it("creates a new WebhookEvent with status 'pending'", async () => {
      const { service } = createService()

      const result = await service.queueWebhookRetry(
        "razorpay",
        "payment.captured",
        '{"event":"payment.captured"}',
        "Connection timeout"
      )

      expect(result.provider).toBe("razorpay")
      expect(result.event_type).toBe("payment.captured")
      expect(result.status).toBe("pending")
      expect(result.attempts).toBe(1)
      expect(result.last_error).toBe("Connection timeout")
      expect(result.next_retry_at).toBeDefined()
    })

    it("increments attempts on existing pending event", async () => {
      const { service } = createService()

      // First attempt
      await service.queueWebhookRetry(
        "razorpay",
        "payment.captured",
        '{"event":"payment.captured"}',
        "Timeout 1"
      )

      // Second attempt (same payload)
      const result = await service.queueWebhookRetry(
        "razorpay",
        "payment.captured",
        '{"event":"payment.captured"}',
        "Timeout 2"
      )

      expect(result.attempts).toBe(2)
      expect(result.last_error).toBe("Timeout 2")
    })

    it("marks as dead_letter after max attempts", async () => {
      const { service, store } = createService()

      // Create event already at max attempts
      store.push({
        id: "wh_maxed",
        provider: "razorpay",
        event_type: "payment.captured",
        payload: '{"event":"max_test"}',
        status: "pending",
        attempts: 4,
        max_attempts: 5,
        last_error: "Previous error",
        next_retry_at: null,
      })

      const result = await service.queueWebhookRetry(
        "razorpay",
        "payment.captured",
        '{"event":"max_test"}',
        "Final error"
      )

      expect(result.status).toBe("dead_letter")
      expect(result.last_error).toBe("Final error")
    })
  })

  describe("markProcessed", () => {
    it("sets status to 'completed' and processed_at", async () => {
      const { service, store } = createService()

      store.push({
        id: "wh_proc1",
        provider: "razorpay",
        status: "processing",
        attempts: 2,
      })

      const result = await service.markProcessed("wh_proc1")

      expect(result.status).toBe("completed")
      expect(result.processed_at).toBeDefined()
      expect(result.processed_at).toBeInstanceOf(Date)
    })
  })

  describe("markDeadLetter", () => {
    it("sets status to 'dead_letter' with error message", async () => {
      const { service, store } = createService()

      store.push({
        id: "wh_dead1",
        provider: "razorpay",
        status: "failed",
        attempts: 5,
      })

      const result = await service.markDeadLetter("wh_dead1", "Max retries exceeded")

      expect(result.status).toBe("dead_letter")
      expect(result.last_error).toBe("Max retries exceeded")
    })
  })

  describe("getFailedWebhooks", () => {
    it("returns failed and dead_letter events", async () => {
      const { service, store } = createService()

      store.push(
        { id: "wh_f1", provider: "razorpay", status: "failed" },
        { id: "wh_f2", provider: "razorpay", status: "dead_letter" },
        { id: "wh_f3", provider: "razorpay", status: "completed" },
        { id: "wh_f4", provider: "razorpay", status: "pending" }
      )

      const result = await service.getFailedWebhooks()

      expect(result).toHaveLength(2)
      expect(result.map((r: any) => r.id).sort()).toEqual(["wh_f1", "wh_f2"])
    })

    it("filters by provider when specified", async () => {
      const { service, store } = createService()

      store.push(
        { id: "wh_rz1", provider: "razorpay", status: "failed" },
        { id: "wh_st1", provider: "stripe", status: "failed" },
        { id: "wh_rz2", provider: "razorpay", status: "dead_letter" }
      )

      const result = await service.getFailedWebhooks("razorpay")

      expect(result).toHaveLength(2)
      expect(result.every((r: any) => r.provider === "razorpay")).toBe(true)
    })
  })

  describe("getHealthStatus", () => {
    it("returns correct counts by status", async () => {
      const { service, store } = createService()

      store.push(
        { id: "h1", status: "pending" },
        { id: "h2", status: "pending" },
        { id: "h3", status: "completed" },
        { id: "h4", status: "failed" },
        { id: "h5", status: "dead_letter" },
        { id: "h6", status: "processing" }
      )

      const result = await service.getHealthStatus()

      expect(result.pending).toBe(2)
      expect(result.completed).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.dead_letter).toBe(1)
      expect(result.processing).toBe(1)
    })

    it("returns all zeros when no events exist", async () => {
      const { service } = createService()

      const result = await service.getHealthStatus()

      expect(result.pending).toBe(0)
      expect(result.completed).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.dead_letter).toBe(0)
    })
  })

  describe("getRetryableEvents", () => {
    it("returns pending events whose next_retry_at has passed", async () => {
      const { service, store } = createService()

      const pastDate = new Date()
      pastDate.setMinutes(pastDate.getMinutes() - 10)

      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 30)

      store.push(
        { id: "r1", status: "pending", next_retry_at: pastDate.toISOString() },
        { id: "r2", status: "pending", next_retry_at: futureDate.toISOString() },
        { id: "r3", status: "pending", next_retry_at: null },
        { id: "r4", status: "completed", next_retry_at: pastDate.toISOString() }
      )

      const result = await service.getRetryableEvents()

      // r1 (past) + r3 (null = immediate) should be retryable
      expect(result).toHaveLength(2)
      expect(result.map((r: any) => r.id).sort()).toEqual(["r1", "r3"])
    })
  })
})
