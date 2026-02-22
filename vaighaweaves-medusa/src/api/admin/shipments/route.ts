/**
 * Admin API: Shipments
 *
 * GET  /admin/shipments — List fulfillments with filters
 * POST /admin/shipments — Create fulfillment for an order (triggers carrier booking)
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/shipments
 *
 * Query params:
 *   ?order_id=order_123
 *   ?status=shipped|delivered|cancelled
 *   ?limit=20&offset=0
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { order_id, limit, offset } = req.query as Record<string, string>

  const filters: Record<string, any> = {}
  if (order_id) {
    filters.order_id = order_id
  }

  const { data: fulfillments } = await (query as any).graph({
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
    filters,
    pagination: {
      take: parseInt(limit || "20"),
      skip: parseInt(offset || "0"),
    },
  })

  return res.json({
    fulfillments,
    count: fulfillments.length,
    limit: parseInt(limit || "20"),
    offset: parseInt(offset || "0"),
  })
}

/**
 * POST /admin/shipments
 *
 * Body:
 * {
 *   order_id: string,
 *   items: [{ id: string, quantity: number }],
 *   shipping_option_id?: string,
 *   metadata?: Record<string, unknown>
 * }
 *
 * Creates a fulfillment using Medusa's built-in order fulfillment workflow.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fulfillmentModule = req.scope.resolve(Modules.FULFILLMENT) as any
  const body = req.body as {
    order_id: string
    items: { id: string; quantity: number }[]
    shipping_option_id?: string
    metadata?: Record<string, unknown>
  }

  if (!body.order_id) {
    return res.status(400).json({ error: "order_id is required" })
  }

  if (!body.items?.length) {
    return res.status(400).json({ error: "items array is required" })
  }

  try {
    const fulfillment = await fulfillmentModule.createFulfillment({
      order_id: body.order_id,
      items: body.items,
      shipping_option_id: body.shipping_option_id,
      metadata: body.metadata,
    })

    return res.status(201).json({ fulfillment })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
