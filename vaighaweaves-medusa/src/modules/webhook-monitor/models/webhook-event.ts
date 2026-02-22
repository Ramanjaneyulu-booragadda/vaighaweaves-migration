/**
 * WebhookEvent model — Dead letter queue + audit log for webhook processing.
 *
 * Tracks every failed webhook delivery attempt. Events start as "pending",
 * move through "processing" → "completed" or "failed", and eventually
 * "dead_letter" after max retries.
 */
import { model } from "@medusajs/framework/utils"

export const WebhookEventStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  DEAD_LETTER: "dead_letter",
} as const

export type WebhookEventStatusValue =
  (typeof WebhookEventStatus)[keyof typeof WebhookEventStatus]

const WebhookEvent = model.define("webhook_event", {
  id: model.id().primaryKey(),

  /** Payment provider or service that sent the webhook (e.g. "razorpay"). */
  provider: model.text(),

  /** Webhook event type (e.g. "payment.captured", "payment.failed"). */
  event_type: model.text(),

  /** Raw webhook payload as JSON string for replay. */
  payload: model.text(),

  /** Current processing status. */
  status: model.text().default("pending"),

  /** Number of delivery/processing attempts so far. */
  attempts: model.number().default(0),

  /** Maximum retry attempts before moving to dead_letter. */
  max_attempts: model.number().default(5),

  /** Error message from the most recent failed attempt. */
  last_error: model.text().nullable(),

  /** When the next retry should be attempted (for backoff scheduling). */
  next_retry_at: model.dateTime().nullable(),

  /** When the event was successfully processed. */
  processed_at: model.dateTime().nullable(),
})

export default WebhookEvent
