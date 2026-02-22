import { useState, useEffect } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useNavigate } from "react-router-dom"
import { Container, Heading, Button, Badge, Table, Text } from "@medusajs/ui"

type Reservation = {
  id: string
  product_title: string
  quantity: number
  status: "ACTIVE" | "EXPIRED" | "CONVERTED"
  created_at: string
}

type ReservationsResponse = {
  reservations: Reservation[]
}

type Order = {
  id: string
  display_id: number
}

type OrderWidgetProps = {
  data: {
    order: Order
  }
}

function OrderActionsWidget({ data }: OrderWidgetProps) {
  const { order } = data
  const navigate = useNavigate()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/admin/stock-reservations?order_id=${order.id}`)
      .then((r) => r.json())
      .then((res: ReservationsResponse) => {
        setReservations(res.reservations ?? [])
      })
      .catch(() => setReservations([]))
      .finally(() => setLoading(false))
  }, [order.id])

  const statusColor = (
    status: "ACTIVE" | "EXPIRED" | "CONVERTED"
  ): "green" | "red" | "orange" => {
    if (status === "ACTIVE") return "green"
    if (status === "CONVERTED") return "orange"
    return "red"
  }

  return (
    <Container>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <Heading level="h3">Order Actions</Heading>
        <Button
          size="small"
          onClick={() =>
            navigate(`/orders/${order.id}/fulfillment`)
          }
        >
          Create Shipment
        </Button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Text size="small" weight="plus">
          Order #{order.display_id}
        </Text>
      </div>

      <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
        Linked Reservations
      </Heading>

      {loading ? (
        <Text>Loading…</Text>
      ) : reservations.length === 0 ? (
        <Text>No reservations linked to this order.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product</Table.HeaderCell>
              <Table.HeaderCell>Qty</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {reservations.map((res) => (
              <Table.Row key={res.id}>
                <Table.Cell>{res.product_title}</Table.Cell>
                <Table.Cell>{res.quantity}</Table.Cell>
                <Table.Cell>
                  <Badge color={statusColor(res.status)}>{res.status}</Badge>
                </Table.Cell>
                <Table.Cell>
                  {new Date(res.created_at).toLocaleDateString("en-IN")}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderActionsWidget
