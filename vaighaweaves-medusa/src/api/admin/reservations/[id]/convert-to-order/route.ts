import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reservationToOrderWorkflow } from "../../../../workflows/reservation-to-order"

type ConvertToOrderBody = {
  payment_ref: string
  notes?: string
  guest_info?: { email: string; first_name?: string; last_name?: string }
  items?: Array<{ variant_id: string; quantity: number }>
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id: reservation_id } = req.params
  const { payment_ref, notes, guest_info, items } = req.body as ConvertToOrderBody

  if (!payment_ref) {
    return res.status(400).json({ message: "payment_ref is required" })
  }

  const { result } = await reservationToOrderWorkflow(req.scope).run({
    input: {
      reservation_id,
      guest_info: guest_info ?? {
        email: `reservation+${reservation_id}@vaighaweaves.com`,
      },
      items: items ?? [],
      payment_ref,
      notes,
    },
  })

  res.status(200).json({ order_id: result.order_id, reservation_id })
}
