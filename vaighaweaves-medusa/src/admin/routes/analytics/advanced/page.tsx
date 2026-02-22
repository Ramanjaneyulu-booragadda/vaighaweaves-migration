import { useState, useEffect } from "react"
import { Container, Heading, Button, Text, Table } from "@medusajs/ui"

type Period = "7d" | "30d" | "90d"

type CohortRow = {
  cohort: string
  users: number
  retained_30d: number
  retained_90d: number
}

type PaymentBreakdown = {
  method: string
  revenue: number
  count: number
}

type GeoBreakdown = {
  state: string
  orders: number
  revenue: number
}

type AdvancedAnalytics = {
  cohorts: CohortRow[]
  payment_breakdown: PaymentBreakdown[]
  geo_breakdown: GeoBreakdown[]
}

type AdvancedResponse = {
  analytics: AdvancedAnalytics
}

function AdvancedAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d")
  const [data, setData] = useState<AdvancedAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/admin/analytics/advanced?period=${period}`)
      .then((r) => r.json())
      .then((res: AdvancedResponse) => {
        setData(res.analytics ?? null)
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
        <Heading>Advanced Analytics</Heading>
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

      {!loading && !data && <Text>No advanced analytics data available.</Text>}

      {!loading && data && (
        <>
          {/* Cohort Analysis */}
          <div style={{ marginBottom: "2rem" }}>
            <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
              Cohort Analysis
            </Heading>
            {data.cohorts.length === 0 ? (
              <Text>No cohort data.</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Cohort</Table.HeaderCell>
                    <Table.HeaderCell>Users</Table.HeaderCell>
                    <Table.HeaderCell>Retained 30d (%)</Table.HeaderCell>
                    <Table.HeaderCell>Retained 90d (%)</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.cohorts.map((row) => (
                    <Table.Row key={row.cohort}>
                      <Table.Cell>{row.cohort}</Table.Cell>
                      <Table.Cell>{row.users}</Table.Cell>
                      <Table.Cell>
                        {row.users > 0
                          ? ((row.retained_30d / row.users) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </Table.Cell>
                      <Table.Cell>
                        {row.users > 0
                          ? ((row.retained_90d / row.users) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>

          {/* Revenue by Payment Method */}
          <div style={{ marginBottom: "2rem" }}>
            <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
              Revenue by Payment Method
            </Heading>
            {data.payment_breakdown.length === 0 ? (
              <Text>No payment data.</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Method</Table.HeaderCell>
                    <Table.HeaderCell>Orders</Table.HeaderCell>
                    <Table.HeaderCell>Revenue</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.payment_breakdown.map((pb) => (
                    <Table.Row key={pb.method}>
                      <Table.Cell>{pb.method}</Table.Cell>
                      <Table.Cell>{pb.count}</Table.Cell>
                      <Table.Cell>
                        ₹{(pb.revenue / 100).toFixed(2)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>

          {/* Geographic Breakdown */}
          <div>
            <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
              Geographic Breakdown
            </Heading>
            {data.geo_breakdown.length === 0 ? (
              <Text>No geographic data.</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>State</Table.HeaderCell>
                    <Table.HeaderCell>Orders</Table.HeaderCell>
                    <Table.HeaderCell>Revenue</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.geo_breakdown.map((geo) => (
                    <Table.Row key={geo.state}>
                      <Table.Cell>{geo.state}</Table.Cell>
                      <Table.Cell>{geo.orders}</Table.Cell>
                      <Table.Cell>
                        ₹{(geo.revenue / 100).toFixed(2)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>
        </>
      )}
    </Container>
  )
}

export default AdvancedAnalyticsPage
