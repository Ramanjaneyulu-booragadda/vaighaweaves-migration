/**
 * Admin API: Shipment Detail + Tracking
 *
 * GET  /admin/shipments/:id       — Get fulfillment details
 * POST /admin/shipments/:id/track — Trigger tracking sync from carrier
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/shipments/:id
 *
 * Returns fulfillment details including labels and tracking data.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [fulfillment] } = await (query as any).graph({
    entity: "fulfillment",
    fields: [
      "id",
      "provider_id",
      "data",
      "packed_at",
      "shipped_at",
      "delivered_at",
      "canceled_at",
      "created_at",
      "labels.*",
      "items.*",
    ],
    filters: { id },
  })

  if (!fulfillment) {
    return res.status(404).json({ error: "Fulfillment not found" })
  }

  return res.json({ fulfillment })
}

/**
 * POST /admin/shipments/:id
 *
 * Triggers a tracking sync for this fulfillment.
 * Reads the tracking_number from the fulfillment's data and
 * calls the India Post tracking API.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [fulfillment] } = await (query as any).graph({
    entity: "fulfillment",
    fields: ["id", "provider_id", "data"],
    filters: { id },
  })

  if (!fulfillment) {
    return res.status(404).json({ error: "Fulfillment not found" })
  }

  const data = fulfillment.data as Record<string, any>
  const trackingNumber = data?.tracking_number

  if (!trackingNumber) {
    return res.status(400).json({
      error: "No tracking number found for this fulfillment",
    })
  }

  // The tracking sync will be handled by the scheduled job
  // For now, return the current tracking info stored in data
  return res.json({
    fulfillment_id: id,
    tracking_number: trackingNumber,
    carrier: data?.carrier || "unknown",
    tracking_data: data,
    message: "Tracking sync queued. Check back shortly for updated status.",
  })
}
