/**
 * Scheduled job: Shipment Tracking Sync
 *
 * Runs every 15 minutes. Queries all active fulfillments (those with
 * tracking numbers but not yet delivered/cancelled) and syncs tracking
 * status from India Post API.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IndiaPostClient } from "../modules/fulfillment-indian-carriers/india-post-client"

export default async function shipmentTrackingSync(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as any
  const logger = container.resolve("logger") as any

  try {
    // Get all fulfillments that have tracking numbers but aren't delivered/cancelled
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "provider_id", "data", "delivered_at", "canceled_at"],
      filters: {
        delivered_at: null,
        canceled_at: null,
      },
    })

    const trackable = fulfillments.filter((f: any) => {
      const data = f.data as Record<string, any>
      return data?.tracking_number && data?.carrier === "india-post"
    })

    if (trackable.length === 0) {
      logger.debug("[shipment-tracking-sync] No active shipments to track")
      return
    }

    logger.info(
      `[shipment-tracking-sync] Syncing ${trackable.length} active shipments`
    )

    // Initialize India Post client from env vars
    const client = new IndiaPostClient({
      api_url: process.env.INDIA_POST_API_URL || "",
      customer_id: process.env.INDIA_POST_CUSTOMER_ID || "",
      password: process.env.INDIA_POST_PASSWORD || "",
      sender_name: process.env.INDIA_POST_SENDER_NAME || "",
      sender_address: process.env.INDIA_POST_SENDER_ADDRESS || "",
      sender_pincode: process.env.INDIA_POST_SENDER_PINCODE || "",
      sender_phone: process.env.INDIA_POST_SENDER_PHONE || "",
    })

    for (const fulfillment of trackable) {
      const data = fulfillment.data as Record<string, any>
      const trackingNumber = data.tracking_number

      try {
        const tracking = await client.trackShipment(trackingNumber)

        // Update fulfillment data with latest tracking info
        await fulfillmentModule.updateFulfillment(fulfillment.id, {
          data: {
            ...data,
            tracking_status: tracking.status,
            tracking_events: tracking.events,
            last_tracked_at: new Date().toISOString(),
          },
        })

        // If delivered, mark the fulfillment
        if (tracking.status === "delivered") {
          logger.info(
            `[shipment-tracking-sync] ${trackingNumber} delivered!`
          )
        }

        logger.debug(
          `[shipment-tracking-sync] ${trackingNumber}: ${tracking.status}`
        )
      } catch (err: any) {
        logger.warn(
          `[shipment-tracking-sync] Failed to track ${trackingNumber}: ${err.message}`
        )
      }
    }
  } catch (err: any) {
    logger.error(
      `[shipment-tracking-sync] Sync failed: ${err.message}`
    )
  }
}

export const config = {
  name: "shipment-tracking-sync",
  schedule: "*/15 * * * *", // Every 15 minutes
}
