/**
 * webhook-monitor Medusa module definition.
 *
 * Registered in medusa-config.ts under the key "webhookMonitor".
 * Resolve from the container:
 *
 *   import { WEBHOOK_MONITOR_MODULE } from "../modules/webhook-monitor"
 *   const webhookService = container.resolve(WEBHOOK_MONITOR_MODULE)
 */
import { Module } from "@medusajs/framework/utils"
import WebhookMonitorModuleService from "./service"

export const WEBHOOK_MONITOR_MODULE = "webhookMonitor"

export default Module(WEBHOOK_MONITOR_MODULE, {
  service: WebhookMonitorModuleService,
})
