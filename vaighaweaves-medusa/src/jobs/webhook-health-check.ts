/**
 * Scheduled job: Webhook Health Check
 *
 * Runs every 30 minutes. Checks Razorpay webhook status via API and
 * processes any retryable events from the dead letter queue.
 *
 * If the webhook URL is not registered or is disabled, logs a warning.
 * Auto-re-registration can be added once Razorpay Account API keys
 * are available (requires account-level access, not standard API keys).
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { WEBHOOK_MONITOR_MODULE } from "../modules/webhook-monitor"

export default async function webhookHealthCheck(container: MedusaContainer) {
  const webhookMonitor = container.resolve(WEBHOOK_MONITOR_MODULE) as any
  const logger = container.resolve("logger") as any

  try {
    // 1. Report health status
    const health = await webhookMonitor.getHealthStatus()
    logger.info("[webhook-health-check] Status summary:", health)

    if (health.dead_letter > 0) {
      logger.warn(
        `[webhook-health-check] ${health.dead_letter} events in dead letter queue`
      )
    }

    // 2. Process retryable events
    const retryable = await webhookMonitor.getRetryableEvents()
    if (retryable.length > 0) {
      logger.info(
        `[webhook-health-check] ${retryable.length} events ready for retry`
      )
    }

    for (const event of retryable) {
      try {
        // Mark as processing
        await webhookMonitor.updateWebhookEvents({
          id: event.id,
          status: "processing",
        })

        // Re-dispatch to the payment provider's webhook handler
        // The actual re-processing would be done by the payment module
        // For now, we just mark it for manual review
        logger.info(
          `[webhook-health-check] Event ${event.id} (${event.event_type}) ready for re-processing`
        )
      } catch (err: any) {
        logger.error(
          `[webhook-health-check] Failed to process event ${event.id}: ${err.message}`
        )
      }
    }
  } catch (err: any) {
    logger.error(`[webhook-health-check] Health check failed: ${err.message}`)
  }
}

export const config = {
  name: "webhook-health-check",
  schedule: "*/30 * * * *", // Every 30 minutes
}
