import { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Container, Heading, Button, Text, Table } from "@medusajs/ui"

type Period = "7d" | "30d" | "90d"

type TopProduct = {
  product_id: string
  title: string
  revenue: number
  count: number
}

type AnalyticsOverview = {
  revenue: number
  orders_by_status: Record<string, number>
  top_products: TopProduct[]
  customers: {
    new: number
    returning: number
    total: number
  }
}

type AnalyticsResponse = {
  overview: AnalyticsOverview
}

function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d")
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/admin/analytics/overview?period=${period}`)
      .then((r) => r.json())
      .then((res: AnalyticsResponse) => {
        setData(res.overview ?? null)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [period])

  const periods: Period[] = ["7d", "30d", "90d"]

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
        <Heading>Analytics</Heading>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {periods.map((p) => (
            <Button
              key={p}
              size="small"
              variant={period === p ? "primary" : "secondary"}
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {loading && <Text>Loading…</Text>}

      {!loading && !data && <Text>No analytics data available.</Text>}

      {!loading && data && (
        <>
          {/* Revenue Summary */}
          <Container style={{ marginBottom: "1.5rem" }}>
            <Text size="small" weight="plus">
              Total Revenue
            </Text>
            <Heading level="h2">₹{(data.revenue / 100).toFixed(2)}</Heading>
          </Container>

          {/* Orders by Status */}
          <div style={{ marginBottom: "1.5rem" }}>
            <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
              Orders by Status
            </Heading>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {Object.entries(data.orders_by_status).map(([status, count]) => (
                <Container key={status} style={{ minWidth: "120px" }}>
                  <Text size="small">{status}</Text>
                  <Heading level="h2">{count}</Heading>
                </Container>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div style={{ marginBottom: "1.5rem" }}>
            <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
              Top Products
            </Heading>
            {data.top_products.length === 0 ? (
              <Text>No product data.</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Product</Table.HeaderCell>
                    <Table.HeaderCell>Orders</Table.HeaderCell>
                    <Table.HeaderCell>Revenue</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.top_products.map((p) => (
                    <Table.Row key={p.product_id}>
                      <Table.Cell>{p.title}</Table.Cell>
                      <Table.Cell>{p.count}</Table.Cell>
                      <Table.Cell>₹{(p.revenue / 100).toFixed(2)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>

          {/* Customer Summary */}
          <div>
            <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
              Customers
            </Heading>
            <div style={{ display: "flex", gap: "1rem" }}>
              <Container>
                <Text size="small" weight="plus">
                  New
                </Text>
                <Heading level="h2">{data.customers.new}</Heading>
              </Container>
              <Container>
                <Text size="small" weight="plus">
                  Returning
                </Text>
                <Heading level="h2">{data.customers.returning}</Heading>
              </Container>
              <Container>
                <Text size="small" weight="plus">
                  Total
                </Text>
                <Heading level="h2">{data.customers.total}</Heading>
              </Container>
            </div>
          </div>
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export default AnalyticsPage
