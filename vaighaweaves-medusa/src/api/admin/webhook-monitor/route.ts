/**
 * Admin API: Webhook Monitor
 *
 * GET  /admin/webhook-monitor         — List webhook events with filters + health summary
 * POST /admin/webhook-monitor/retry   — Manually retry a dead_letter event
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WEBHOOK_MONITOR_MODULE } from "../../../modules/webhook-monitor"

/**
 * GET /admin/webhook-monitor
 *
 * Query params:
 *   ?status=failed|dead_letter|pending|completed
 *   ?provider=razorpay
 *   ?summary=true  (returns only health counts)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const webhookMonitor = req.scope.resolve(WEBHOOK_MONITOR_MODULE) as any
  const { status, provider, summary } = req.query as Record<string, string>

  if (summary === "true") {
    const health = await webhookMonitor.getHealthStatus()
    return res.json({ health })
  }

  const filters: Record<string, any> = {}
  if (status) filters.status = status
  if (provider) filters.provider = provider

  const events = await webhookMonitor.listWebhookEvents({ filters })
  return res.json({ webhook_events: events, count: events.length })
}

/**
 * POST /admin/webhook-monitor
 *
 * Body: { webhook_event_id: string }
 *
 * Resets a dead_letter event back to "pending" for retry.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const webhookMonitor = req.scope.resolve(WEBHOOK_MONITOR_MODULE) as any
  const { webhook_event_id } = req.body as { webhook_event_id: string }

  if (!webhook_event_id) {
    return res.status(400).json({ error: "webhook_event_id is required" })
  }

  const events = await webhookMonitor.listWebhookEvents({
    filters: { id: webhook_event_id },
  })

  if (!events.length) {
    return res.status(404).json({ error: "Webhook event not found" })
  }

  const event = events[0]
  if (event.status !== "dead_letter" && event.status !== "failed") {
    return res.status(400).json({
      error: `Cannot retry event with status '${event.status}'. Only 'failed' or 'dead_letter' events can be retried.`,
    })
  }

  const updated = await webhookMonitor.updateWebhookEvents({
    id: webhook_event_id,
    status: "pending",
    attempts: 0,
    next_retry_at: new Date(),
  })

  return res.json({ webhook_event: updated })
}
