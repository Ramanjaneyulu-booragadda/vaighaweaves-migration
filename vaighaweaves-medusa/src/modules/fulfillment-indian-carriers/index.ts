import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import IndianCarriersFulfillmentService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [IndianCarriersFulfillmentService],
})
