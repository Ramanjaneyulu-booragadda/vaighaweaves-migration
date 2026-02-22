/**
 * WebhookMonitorModuleService
 *
 * Manages webhook event tracking with dead letter queue support.
 * Extends MedusaService for auto-generated CRUD, adds custom business
 * logic for retry queueing, processing, and health reporting.
 */
import { MedusaService } from "@medusajs/framework/utils"
import WebhookEvent, { WebhookEventStatus } from "./models/webhook-event"

class WebhookMonitorModuleService extends MedusaService({
  WebhookEvent,
}) {
  /**
   * Record a failed webhook and queue it for retry.
   * Creates a WebhookEvent with status "pending" and calculates
   * the next retry time using exponential backoff.
   */
  async queueWebhookRetry(
    provider: string,
    eventType: string,
    payload: string,
    error: string
  ): Promise<Record<string, any>> {
    // Check if this payload already exists (idempotency)
    const existing = await this.listWebhookEvents({
      filters: { provider, payload, status: WebhookEventStatus.PENDING },
    })

    if (existing.length > 0) {
      // Increment attempts on existing record
      const event = existing[0]
      const newAttempts = (event.attempts || 0) + 1
      const maxAttempts = event.max_attempts || 5

      if (newAttempts >= maxAttempts) {
        return this.markDeadLetter(event.id, error)
      }

      const nextRetry = this.calculateNextRetry(newAttempts)
      const updated = await this.updateWebhookEvents({
        id: event.id,
        attempts: newAttempts,
        last_error: error,
        next_retry_at: nextRetry,
      })
      return updated
    }

    const nextRetry = this.calculateNextRetry(1)
    const created = await this.createWebhookEvents({
      provider,
      event_type: eventType,
      payload,
      status: WebhookEventStatus.PENDING,
      attempts: 1,
      max_attempts: 5,
      last_error: error,
      next_retry_at: nextRetry,
    })
    return created
  }

  /**
   * Mark a webhook event as successfully processed.
   */
  async markProcessed(webhookEventId: string): Promise<Record<string, any>> {
    const updated = await this.updateWebhookEvents({
      id: webhookEventId,
      status: WebhookEventStatus.COMPLETED,
      processed_at: new Date(),
    })
    return updated
  }

  /**
   * Mark a webhook event as permanently failed (dead letter).
   * Called after max retry attempts are exhausted.
   */
  async markDeadLetter(
    webhookEventId: string,
    error: string
  ): Promise<Record<string, any>> {
    const updated = await this.updateWebhookEvents({
      id: webhookEventId,
      status: WebhookEventStatus.DEAD_LETTER,
      last_error: error,
    })
    return updated
  }

  /**
   * Get failed/dead_letter webhook events, optionally filtered by provider.
   */
  async getFailedWebhooks(
    provider?: string
  ): Promise<Record<string, any>[]> {
    const filters: Record<string, any> = {
      status: [WebhookEventStatus.FAILED, WebhookEventStatus.DEAD_LETTER],
    }
    if (provider) {
      filters.provider = provider
    }
    return this.listWebhookEvents({ filters })
  }

  /**
   * Get health summary: counts by status for monitoring dashboards.
   */
  async getHealthStatus(): Promise<Record<string, number>> {
    const allEvents = await this.listWebhookEvents({})
    const counts: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead_letter: 0,
    }

    for (const event of allEvents) {
      const status = event.status as string
      if (status in counts) {
        counts[status]++
      }
    }

    return counts
  }

  /**
   * Get events ready for retry (next_retry_at <= now, status = pending).
   */
  async getRetryableEvents(): Promise<Record<string, any>[]> {
    const pending = await this.listWebhookEvents({
      filters: { status: WebhookEventStatus.PENDING },
    })

    const now = new Date()
    return pending.filter((e) => {
      if (!e.next_retry_at) return true
      return new Date(e.next_retry_at as string) <= now
    })
  }

  /**
   * Calculate next retry time using exponential backoff.
   * Attempt 1: 1 min, 2: 5 min, 3: 15 min, 4: 30 min, 5: 60 min
   */
  private calculateNextRetry(attempt: number): Date {
    const backoffMinutes = [1, 5, 15, 30, 60]
    const minutes = backoffMinutes[Math.min(attempt - 1, backoffMinutes.length - 1)]
    const next = new Date()
    next.setMinutes(next.getMinutes() + minutes)
    return next
  }
}

export default WebhookMonitorModuleService
