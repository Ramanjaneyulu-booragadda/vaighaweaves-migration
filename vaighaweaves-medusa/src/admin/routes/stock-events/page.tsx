import { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Badge,
  Table,
  Tabs,
  Text,
  Select,
} from "@medusajs/ui"

type ReservationStatus = "ACTIVE" | "EXPIRED" | "CONVERTED"
type ReservationType = "PHONE" | "WALK_IN" | "ONLINE"

type Reservation = {
  id: string
  customer_name: string
  product_title: string
  quantity: number
  expires_at: string
  status: ReservationStatus
  type: ReservationType
}

type StockEvent = {
  id: string
  variant_title: string
  event_type: string
  quantity_change: number
  created_at: string
}

type ReservationsResponse = {
  reservations: Reservation[]
}

type StockEventsResponse = {
  events: StockEvent[]
}

function StockEventsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [stockEvents, setStockEvents] = useState<StockEvent[]>([])
  const [loadingRes, setLoadingRes] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<string>("")

  useEffect(() => {
    fetch("/admin/stock-reservations")
      .then((r) => r.json())
      .then((data: ReservationsResponse) => {
        setReservations(data.reservations ?? [])
      })
      .catch(() => setReservations([]))
      .finally(() => setLoadingRes(false))
  }, [])

  useEffect(() => {
    fetch("/admin/stock-events")
      .then((r) => r.json())
      .then((data: StockEventsResponse) => {
        setStockEvents(data.events ?? [])
      })
      .catch(() => setStockEvents([]))
      .finally(() => setLoadingEvents(false))
  }, [])

  const handleConvert = async (id: string) => {
    try {
      await fetch(`/admin/reservations/${id}/convert-to-order`, {
        method: "POST",
      })
      setReservations((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "CONVERTED" as ReservationStatus } : r
        )
      )
    } catch {
      // silent
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/admin/stock-reservations/${id}`, { method: "DELETE" })
      setReservations((prev) => prev.filter((r) => r.id !== id))
    } catch {
      // silent
    }
  }

  const statusBadgeColor = (
    status: ReservationStatus
  ): "green" | "orange" | "red" => {
    if (status === "ACTIVE") return "green"
    if (status === "CONVERTED") return "orange"
    return "red"
  }

  const filteredReservations = reservations.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (typeFilter && r.type !== typeFilter) return false
    return true
  })

  return (
    <Container>
      <Heading style={{ marginBottom: "1.5rem" }}>Stock Events</Heading>

      <Tabs defaultValue="reservations">
        <Tabs.List>
          <Tabs.Trigger value="reservations">Active Reservations</Tabs.Trigger>
          <Tabs.Trigger value="log">Stock Events Log</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="reservations">
          {/* Filters */}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1rem",
              marginTop: "1rem",
            }}
          >
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <Select.Trigger>
                <Select.Value placeholder="All Statuses" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">All Statuses</Select.Item>
                <Select.Item value="ACTIVE">Active</Select.Item>
                <Select.Item value="EXPIRED">Expired</Select.Item>
                <Select.Item value="CONVERTED">Converted</Select.Item>
              </Select.Content>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <Select.Trigger>
                <Select.Value placeholder="All Types" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">All Types</Select.Item>
                <Select.Item value="PHONE">Phone</Select.Item>
                <Select.Item value="WALK_IN">Walk-In</Select.Item>
                <Select.Item value="ONLINE">Online</Select.Item>
              </Select.Content>
            </Select>
          </div>

          {loadingRes ? (
            <Text>Loading…</Text>
          ) : filteredReservations.length === 0 ? (
            <Text>No reservations found.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Customer</Table.HeaderCell>
                  <Table.HeaderCell>Product</Table.HeaderCell>
                  <Table.HeaderCell>Qty</Table.HeaderCell>
                  <Table.HeaderCell>Expires</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredReservations.map((res) => (
                  <Table.Row key={res.id}>
                    <Table.Cell>{res.customer_name || "—"}</Table.Cell>
                    <Table.Cell>{res.product_title}</Table.Cell>
                    <Table.Cell>{res.quantity}</Table.Cell>
                    <Table.Cell>
                      {res.expires_at
                        ? new Date(res.expires_at).toLocaleDateString("en-IN")
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={statusBadgeColor(res.status)}>
                        {res.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {res.status === "ACTIVE" && (
                          <>
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => handleConvert(res.id)}
                            >
                              Convert
                            </Button>
                            <Button
                              size="small"
                              variant="danger"
                              onClick={() => handleCancel(res.id)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Tabs.Content>

        <Tabs.Content value="log">
          <div style={{ marginTop: "1rem" }}>
            {loadingEvents ? (
              <Text>Loading…</Text>
            ) : stockEvents.length === 0 ? (
              <Text>No stock events found.</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Variant</Table.HeaderCell>
                    <Table.HeaderCell>Event Type</Table.HeaderCell>
                    <Table.HeaderCell>Qty Change</Table.HeaderCell>
                    <Table.HeaderCell>Timestamp</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {stockEvents.map((ev) => (
                    <Table.Row key={ev.id}>
                      <Table.Cell>{ev.variant_title}</Table.Cell>
                      <Table.Cell>{ev.event_type}</Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={ev.quantity_change >= 0 ? "green" : "red"}
                        >
                          {ev.quantity_change >= 0 ? "+" : ""}
                          {ev.quantity_change}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {new Date(ev.created_at).toLocaleString("en-IN")}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Stock Events",
  icon: ArrowPath,
})

export default StockEventsPage
