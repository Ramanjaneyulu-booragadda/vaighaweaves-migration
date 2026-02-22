import { useState, useEffect } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Table,
  Text,
  Input,
  Label,
} from "@medusajs/ui"

type Variant = {
  id: string
  title: string
  sku: string | null
}

type Product = {
  id: string
  title: string
  variants: Variant[]
}

type StockLevel = {
  variant_id: string
  variant_title: string
  sku: string | null
  stocked_quantity: number
  reserved_quantity: number
  available_quantity: number
}

type StockEvent = {
  id: string
  variant_title: string
  event_type: string
  quantity_change: number
  created_at: string
}

type StockLevelsResponse = {
  levels: StockLevel[]
  recent_events: StockEvent[]
}

type ProductWidgetProps = {
  data: {
    product: Product
  }
}

function ProductStockWidget({ data }: ProductWidgetProps) {
  const { product } = data
  const [levels, setLevels] = useState<StockLevel[]>([])
  const [recentEvents, setRecentEvents] = useState<StockEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustVariantId, setAdjustVariantId] = useState("")
  const [adjustQty, setAdjustQty] = useState("0")
  const [adjustNote, setAdjustNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/admin/stock-events?product_id=${product.id}`)
      .then((r) => r.json())
      .then((res: StockLevelsResponse) => {
        setLevels(res.levels ?? [])
        setRecentEvents(res.recent_events ?? [])
      })
      .catch(() => {
        setLevels([])
        setRecentEvents([])
      })
      .finally(() => setLoading(false))
  }, [product.id])

  const handleAdjust = async () => {
    if (!adjustVariantId) return
    setSubmitting(true)
    try {
      await fetch("/admin/stock-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          variant_id: adjustVariantId,
          quantity_change: parseInt(adjustQty, 10) || 0,
          note: adjustNote,
        }),
      })
      setShowAdjust(false)
      setAdjustVariantId("")
      setAdjustQty("0")
      setAdjustNote("")
      // Refresh levels
      setLoading(true)
      const res = await fetch(`/admin/stock-events?product_id=${product.id}`)
      const updated = (await res.json()) as StockLevelsResponse
      setLevels(updated.levels ?? [])
      setRecentEvents(updated.recent_events ?? [])
    } catch {
      // silent
    } finally {
      setSubmitting(false)
      setLoading(false)
    }
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
        <Heading level="h3">Stock Levels</Heading>
        <Button size="small" onClick={() => setShowAdjust((v) => !v)}>
          Adjust Stock
        </Button>
      </div>

      {/* Adjust Form */}
      {showAdjust && (
        <Container
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div>
              <Label>Variant</Label>
              <select
                value={adjustVariantId}
                onChange={(e) => setAdjustVariantId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  fontSize: "0.875rem",
                }}
              >
                <option value="">Select variant…</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} {v.sku ? `(${v.sku})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Quantity Change</Label>
              <Input
                type="number"
                placeholder="e.g. 10 or -5"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                placeholder="Reason for adjustment…"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Button
              size="small"
              onClick={handleAdjust}
              disabled={submitting || !adjustVariantId}
            >
              {submitting ? "Saving…" : "Save"}
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setShowAdjust(false)}
            >
              Cancel
            </Button>
          </div>
        </Container>
      )}

      {loading ? (
        <Text>Loading…</Text>
      ) : levels.length === 0 ? (
        <Text>No stock level data available.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Variant</Table.HeaderCell>
              <Table.HeaderCell>SKU</Table.HeaderCell>
              <Table.HeaderCell>Stocked</Table.HeaderCell>
              <Table.HeaderCell>Reserved</Table.HeaderCell>
              <Table.HeaderCell>Available</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {levels.map((lvl) => (
              <Table.Row key={lvl.variant_id}>
                <Table.Cell>{lvl.variant_title}</Table.Cell>
                <Table.Cell>{lvl.sku || "—"}</Table.Cell>
                <Table.Cell>{lvl.stocked_quantity}</Table.Cell>
                <Table.Cell>{lvl.reserved_quantity}</Table.Cell>
                <Table.Cell>{lvl.available_quantity}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {recentEvents.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
            Recent Stock Events
          </Heading>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Variant</Table.HeaderCell>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Change</Table.HeaderCell>
                <Table.HeaderCell>Date</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recentEvents.map((ev) => (
                <Table.Row key={ev.id}>
                  <Table.Cell>{ev.variant_title}</Table.Cell>
                  <Table.Cell>{ev.event_type}</Table.Cell>
                  <Table.Cell>
                    {ev.quantity_change >= 0 ? "+" : ""}
                    {ev.quantity_change}
                  </Table.Cell>
                  <Table.Cell>
                    {new Date(ev.created_at).toLocaleDateString("en-IN")}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductStockWidget
