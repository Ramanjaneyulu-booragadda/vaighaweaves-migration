import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"

type CustomerType = "existing" | "guest"
type PaymentMethod = "cash" | "card" | "upi" | "online"
type DeliveryType = "pickup" | "shipping"

type CustomerInfo = {
  type: CustomerType
  name: string
  phone: string
  email: string
}

type CartItem = {
  variant_id: string
  title: string
  price: number
  quantity: number
}

type PaymentInfo = {
  method: PaymentMethod
  reference: string
  delivery_type: DeliveryType
  address: string
}

function CreateInStoreSalePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [customer, setCustomer] = useState<CustomerInfo>({
    type: "guest",
    name: "",
    phone: "",
    email: "",
  })
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [payment, setPayment] = useState<PaymentInfo>({
    method: "cash",
    reference: "",
    delivery_type: "pickup",
    address: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const subtotal = cartItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  )
  const gst = subtotal * 0.18
  const total = subtotal + gst

  const handleAddProduct = () => {
    if (!productSearch.trim()) return
    const newItem: CartItem = {
      variant_id: crypto.randomUUID(),
      title: productSearch,
      price: 0,
      quantity: 1,
    }
    setCartItems((prev) => [...prev, newItem])
    setProductSearch("")
  }

  const handleRemoveItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleQuantityChange = (index: number, quantity: number) => {
    setCartItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity } : it))
    )
  }

  const handlePriceChange = (index: number, price: number) => {
    setCartItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, price } : it))
    )
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const body = {
        customer_info: customer,
        items: cartItems,
        payment,
        subtotal,
        gst,
        total,
      }
      const res = await fetch("/admin/draft-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to create order")
      toast.success("Order created", {
        description: "In-store sale recorded successfully.",
      })
      navigate("/in-store-sales")
    } catch {
      toast.error("Error", {
        description: "Failed to create order. Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const stepLabel = (s: number) => {
    if (s === 1) return "1. Customer"
    if (s === 2) return "2. Products"
    return "3. Payment"
  }

  return (
    <Container>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "1.5rem",
          gap: "0.75rem",
        }}
      >
        <Button
          variant="secondary"
          size="small"
          onClick={() => navigate("/in-store-sales")}
        >
          ← Back
        </Button>
        <Heading>New In-Store Sale</Heading>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "0.375rem",
              background: s === step ? "#1a4731" : s < step ? "#dcfce7" : "#f3f4f6",
              color: s === step ? "#fff" : s < step ? "#15803d" : "#6b7280",
              cursor: s < step ? "pointer" : "default",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
            onClick={() => {
              if (s < step) setStep(s)
            }}
          >
            {stepLabel(s)}
          </div>
        ))}
      </div>

      {/* Step 1: Customer */}
      {step === 1 && (
        <div>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <Button
              variant={customer.type === "existing" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCustomer((c) => ({ ...c, type: "existing" }))}
            >
              Existing Customer
            </Button>
            <Button
              variant={customer.type === "guest" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCustomer((c) => ({ ...c, type: "guest" }))}
            >
              Guest
            </Button>
          </div>

          <div style={{ display: "grid", gap: "1rem", maxWidth: "400px" }}>
            <div>
              <Label>Name</Label>
              <Input
                placeholder="Customer name"
                value={customer.name}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                placeholder="Phone number"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, phone: e.target.value }))
                }
              />
            </div>
            {customer.type === "existing" && (
              <div>
                <Label>Email</Label>
                <Input
                  placeholder="Email address"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer((c) => ({ ...c, email: e.target.value }))
                  }
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <Button onClick={() => setStep(2)}>Next: Products →</Button>
          </div>
        </div>
      )}

      {/* Step 2: Products */}
      {step === 2 && (
        <div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "1rem",
              maxWidth: "420px",
            }}
          >
            <Input
              placeholder="Product name…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <Button onClick={handleAddProduct}>Add</Button>
          </div>

          {cartItems.length === 0 ? (
            <Text>No items added yet.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Product</Table.HeaderCell>
                  <Table.HeaderCell>Price (₹)</Table.HeaderCell>
                  <Table.HeaderCell>Qty</Table.HeaderCell>
                  <Table.HeaderCell>Action</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {cartItems.map((item, idx) => (
                  <Table.Row key={item.variant_id}>
                    <Table.Cell>{item.title}</Table.Cell>
                    <Table.Cell>
                      <Input
                        type="number"
                        value={item.price}
                        style={{ width: "90px" }}
                        onChange={(e) =>
                          handlePriceChange(idx, parseFloat(e.target.value) || 0)
                        }
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Input
                        type="number"
                        value={item.quantity}
                        style={{ width: "70px" }}
                        onChange={(e) =>
                          handleQuantityChange(
                            idx,
                            parseInt(e.target.value, 10) || 1
                          )
                        }
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="small"
                        variant="danger"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        Remove
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          <div
            style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}
          >
            <Button variant="secondary" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={cartItems.length === 0}
            >
              Next: Payment →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 3 && (
        <div>
          <div style={{ display: "grid", gap: "1rem", maxWidth: "420px" }}>
            <div>
              <Label>Payment Method</Label>
              <Select
                value={payment.method}
                onValueChange={(v) =>
                  setPayment((p) => ({ ...p, method: v as PaymentMethod }))
                }
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="cash">Cash</Select.Item>
                  <Select.Item value="card">Card</Select.Item>
                  <Select.Item value="upi">UPI</Select.Item>
                  <Select.Item value="online">Online</Select.Item>
                </Select.Content>
              </Select>
            </div>

            {payment.method !== "cash" && (
              <div>
                <Label>Payment Reference</Label>
                <Input
                  placeholder="Transaction ID / Reference"
                  value={payment.reference}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, reference: e.target.value }))
                  }
                />
              </div>
            )}

            <div>
              <Label>Delivery Type</Label>
              <Select
                value={payment.delivery_type}
                onValueChange={(v) =>
                  setPayment((p) => ({
                    ...p,
                    delivery_type: v as DeliveryType,
                  }))
                }
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="pickup">Store Pickup</Select.Item>
                  <Select.Item value="shipping">Shipping</Select.Item>
                </Select.Content>
              </Select>
            </div>

            {payment.delivery_type === "shipping" && (
              <div>
                <Label>Delivery Address</Label>
                <Input
                  placeholder="Full address"
                  value={payment.address}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, address: e.target.value }))
                  }
                />
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              background: "#f9faf9",
              borderRadius: "0.5rem",
              maxWidth: "420px",
              border: "1px solid #e5e7eb",
            }}
          >
            <Text weight="plus">Order Summary</Text>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "0.75rem",
              }}
            >
              <Text>Subtotal</Text>
              <Text>₹{subtotal.toFixed(2)}</Text>
            </div>
            <div
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <Text>GST (18%)</Text>
              <Text>₹{gst.toFixed(2)}</Text>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #e5e7eb",
                marginTop: "0.5rem",
                paddingTop: "0.5rem",
              }}
            >
              <Text weight="plus">Total</Text>
              <Text weight="plus">₹{total.toFixed(2)}</Text>
            </div>
          </div>

          <div
            style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}
          >
            <Button variant="secondary" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Create Order"}
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}

export default CreateInStoreSalePage
