import { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingCart } from "@medusajs/icons"
import { useNavigate } from "react-router-dom"
import { Container, Heading, Button, Badge, Text, Table } from "@medusajs/ui"

type SaleItem = {
  title: string
  quantity: number
}

type Sale = {
  id: string
  customer_name: string
  items: SaleItem[]
  total: number
  status: string
  created_at: string
}

type SalesResponse = {
  reservations: Sale[]
}

function InStoreSalesPage() {
  const navigate = useNavigate()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/admin/stock-reservations?reservation_type=IN_STORE")
      .then((r) => r.json())
      .then((data: SalesResponse) => {
        setSales(data.reservations ?? [])
      })
      .catch(() => setSales([]))
      .finally(() => setLoading(false))
  }, [])

  const totalRevenue = sales.reduce((sum, s) => sum + (s.total ?? 0), 0)
  const totalItems = sales.reduce((sum, s) => sum + (s.items?.length ?? 0), 0)

  const statusColor = (
    status: string
  ): "green" | "orange" | "grey" => {
    if (status === "COMPLETED") return "green"
    if (status === "PENDING") return "orange"
    return "grey"
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
        <Heading>In-Store Sales</Heading>
        <Button onClick={() => navigate("/in-store-sales/create")}>
          New Sale
        </Button>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <Container>
          <Text size="small" weight="plus">
            Total Sales
          </Text>
          <Heading level="h2">{sales.length}</Heading>
        </Container>
        <Container>
          <Text size="small" weight="plus">
            Total Revenue
          </Text>
          <Heading level="h2">₹{(totalRevenue / 100).toFixed(2)}</Heading>
        </Container>
        <Container>
          <Text size="small" weight="plus">
            Total Items
          </Text>
          <Heading level="h2">{totalItems}</Heading>
        </Container>
      </div>

      {/* Sales Table */}
      {loading ? (
        <Text>Loading…</Text>
      ) : sales.length === 0 ? (
        <Text>No in-store sales found.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Products</Table.HeaderCell>
              <Table.HeaderCell>Amount</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sales.map((sale) => (
              <Table.Row key={sale.id}>
                <Table.Cell>{sale.customer_name || "Guest"}</Table.Cell>
                <Table.Cell>
                  {sale.items?.map((i) => i.title).join(", ") || "—"}
                </Table.Cell>
                <Table.Cell>
                  ₹{((sale.total ?? 0) / 100).toFixed(2)}
                </Table.Cell>
                <Table.Cell>
                  <Badge color={statusColor(sale.status)}>
                    {sale.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {new Date(sale.created_at).toLocaleDateString("en-IN")}
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
  label: "In-Store Sales",
  icon: ShoppingCart,
})

export default InStoreSalesPage
