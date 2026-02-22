import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReservationItem = {
  variant_id: string
  quantity: number
}

type GuestInfo = {
  email: string
  first_name?: string
  last_name?: string
}

type WorkflowInput = {
  reservation_id: string
  guest_info: GuestInfo
  items: ReservationItem[]
  payment_ref: string
  notes?: string
}

type WorkflowOutput = {
  order_id: string
  reservation_id: string
}

// ---------------------------------------------------------------------------
// Step 1 – validate reservation is ACTIVE
// ---------------------------------------------------------------------------

const validateReservationStep = createStep(
  "validate-reservation-active",
  async ({ reservation_id }: { reservation_id: string }, { container }) => {
    // In a real implementation this would resolve a reservation module service.
    // We keep the step thin so it compiles and can be wired once the
    // reservation module exists.
    if (!reservation_id) {
      throw new Error("reservation_id is required")
    }
    return new StepResponse({ reservation_id })
  }
)

// ---------------------------------------------------------------------------
// Step 2 – create draft order
// ---------------------------------------------------------------------------

const createDraftOrderStep = createStep(
  "create-draft-order",
  async (
    {
      guest_info,
      items,
    }: { guest_info: GuestInfo; items: ReservationItem[] },
    { container }
  ) => {
    const { client } = container.resolve("http") as any

    // Build line items for the draft order
    const lineItems = items.map((i) => ({
      variant_id: i.variant_id,
      quantity: i.quantity,
      unit_price: 0, // will be set by pricing
    }))

    // Use the Medusa admin API to create the draft order
    const response = await (client as any).post("/admin/draft-orders", {
      email: guest_info.email,
      items: lineItems,
      payment_methods: [{ provider_id: "manual" }],
    })

    const draftOrderId: string = response?.data?.draft_order?.id
    if (!draftOrderId) {
      throw new Error("Failed to create draft order: no id returned")
    }

    return new StepResponse(
      { draft_order_id: draftOrderId },
      { draft_order_id: draftOrderId }
    )
  },
  // compensation: delete the draft order
  async ({ draft_order_id }: { draft_order_id: string }, { container }) => {
    if (!draft_order_id) return
    const { client } = container.resolve("http") as any
    await (client as any)
      .delete(`/admin/draft-orders/${draft_order_id}`)
      .catch(() => {/* best-effort */})
  }
)

// ---------------------------------------------------------------------------
// Step 3 – complete draft order → real order
// ---------------------------------------------------------------------------

const completeDraftOrderStep = createStep(
  "complete-draft-order",
  async ({ draft_order_id }: { draft_order_id: string }, { container }) => {
    const { client } = container.resolve("http") as any
    const response = await (client as any).post(
      `/admin/draft-orders/${draft_order_id}/complete`
    )

    const orderId: string = response?.data?.order?.id
    if (!orderId) {
      throw new Error("Failed to complete draft order: no order id returned")
    }
    return new StepResponse({ order_id: orderId }, { order_id: orderId })
  },
  // compensation: cancel the order
  async ({ order_id }: { order_id: string }, { container }) => {
    if (!order_id) return
    const { client } = container.resolve("http") as any
    await (client as any)
      .post(`/admin/orders/${order_id}/cancel`)
      .catch(() => {/* best-effort */})
  }
)

// ---------------------------------------------------------------------------
// Step 4 – mark reservation as CONVERTED
// ---------------------------------------------------------------------------

const updateReservationStep = createStep(
  "update-reservation-converted",
  async (
    { reservation_id, order_id }: { reservation_id: string; order_id: string },
    { container }
  ) => {
    // Placeholder: resolve reservation module service once it exists.
    return new StepResponse(
      { reservation_id, order_id },
      { reservation_id, previous_status: "ACTIVE" }
    )
  },
  // compensation: revert to ACTIVE
  async (
    {
      reservation_id,
      previous_status,
    }: { reservation_id: string; previous_status: string },
    { container }
  ) => {
    // Revert reservation status on rollback
  }
)

// ---------------------------------------------------------------------------
// Step 5 – deduct stock via StockEventModuleService
// ---------------------------------------------------------------------------

const deductStockStep = createStep(
  "deduct-stock",
  async (
    {
      items,
      order_id,
    }: { items: ReservationItem[]; order_id: string },
    { container }
  ) => {
    // Placeholder: resolve stock-events module service once it exists.
    return new StepResponse({ items, order_id }, { items, order_id })
  },
  // compensation: add stock back
  async (
    { items, order_id }: { items: ReservationItem[]; order_id: string },
    { container }
  ) => {
    // Rollback stock adjustments
  }
)

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export const reservationToOrderWorkflow = createWorkflow(
  "reservation-to-order",
  (input: WorkflowInput) => {
    const { reservation_id } = validateReservationStep({
      reservation_id: input.reservation_id,
    })

    const { draft_order_id } = createDraftOrderStep({
      guest_info: input.guest_info,
      items: input.items,
    })

    const { order_id } = completeDraftOrderStep({ draft_order_id })

    updateReservationStep({ reservation_id, order_id })

    deductStockStep({ items: input.items, order_id })

    return new WorkflowResponse<WorkflowOutput>({ order_id, reservation_id })
  }
)

export default reservationToOrderWorkflow
