import { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BellAlert } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Badge,
  Table,
  Text,
  Select,
} from "@medusajs/ui"

type EventStatus = "queued" | "delivered" | "failed" | "dead"

type WebhookEvent = {
  id: string
  event_type: string
  status: EventStatus
  payload: Record<string, unknown>
  created_at: string
}

type EventsResponse = {
  events: WebhookEvent[]
}

function EventsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [retrying, setRetrying] = useState<string | null>(null)

  useEffect(() => {
    fetch("/admin/webhook-monitor")
      .then((r) => r.json())
      .then((data: EventsResponse) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  const handleRetry = async (eventId: string) => {
    setRetrying(eventId)
    try {
      await fetch("/admin/webhook-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", event_id: eventId }),
      })
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, status: "queued" as EventStatus } : e
        )
      )
    } catch {
      // silent
    } finally {
      setRetrying(null)
    }
  }

  const statusColor = (
    status: EventStatus
  ): "blue" | "green" | "red" | "orange" => {
    if (status === "queued") return "blue"
    if (status === "delivered") return "green"
    if (status === "failed") return "orange"
    return "red"
  }

  const filtered = statusFilter
    ? events.filter((e) => e.status === statusFilter)
    : events

  const payloadPreview = (payload: Record<string, unknown>): string => {
    try {
      const str = JSON.stringify(payload)
      return str.length > 60 ? `${str.slice(0, 60)}…` : str
    } catch {
      return "—"
    }
  }

  return (
    <Container>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <Heading>Event Log</Heading>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <Select.Trigger>
            <Select.Value placeholder="All Statuses" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="">All Statuses</Select.Item>
            <Select.Item value="queued">Queued</Select.Item>
            <Select.Item value="delivered">Delivered</Select.Item>
            <Select.Item value="failed">Failed</Select.Item>
            <Select.Item value="dead">Dead</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {loading ? (
        <Text>Loading…</Text>
      ) : filtered.length === 0 ? (
        <Text>No events found.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Event Type</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Payload Preview</Table.HeaderCell>
              <Table.HeaderCell>Timestamp</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((ev) => (
              <Table.Row key={ev.id}>
                <Table.Cell>{ev.event_type}</Table.Cell>
                <Table.Cell>
                  <Badge color={statusColor(ev.status)}>{ev.status}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <code style={{ fontSize: "0.75rem", color: "#4b5563" }}>
                    {payloadPreview(ev.payload)}
                  </code>
                </Table.Cell>
                <Table.Cell>
                  {new Date(ev.created_at).toLocaleString("en-IN")}
                </Table.Cell>
                <Table.Cell>
                  {(ev.status === "failed" || ev.status === "dead") && (
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={retrying === ev.id}
                      onClick={() => handleRetry(ev.id)}
                    >
                      {retrying === ev.id ? "Retrying…" : "Retry"}
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Event Log",
  icon: BellAlert,
})

export default EventsPage
