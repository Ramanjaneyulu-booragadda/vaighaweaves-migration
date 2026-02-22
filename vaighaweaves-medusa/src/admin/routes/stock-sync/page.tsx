import { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath } from "@medusajs/icons"
import { Container, Heading, Button, Badge, Table, Text } from "@medusajs/ui"

type SyncStatus = "idle" | "running" | "error"

type SyncState = {
  last_synced_at: string | null
  status: SyncStatus
  total_synced: number
}

type AuditEntry = {
  id: string
  action: string
  synced_at: string
  products_count: number
  status: "success" | "error"
}

type SyncResponse = {
  sync: SyncState
  audit_log: AuditEntry[]
}

function StockSyncPage() {
  const [syncState, setSyncState] = useState<SyncState | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchStatus = () => {
    setLoading(true)
    fetch("/admin/stock-sync")
      .then((r) => r.json())
      .then((data: SyncResponse) => {
        setSyncState(data.sync ?? null)
        setAuditLog(data.audit_log ?? [])
      })
      .catch(() => {
        setSyncState(null)
        setAuditLog([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch("/admin/stock-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      })
      fetchStatus()
    } catch {
      // silent
    } finally {
      setSyncing(false)
    }
  }

  const statusColor = (
    status: SyncStatus
  ): "green" | "blue" | "red" => {
    if (status === "idle") return "green"
    if (status === "running") return "blue"
    return "red"
  }

  const auditColor = (
    status: "success" | "error"
  ): "green" | "red" => (status === "success" ? "green" : "red")

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
        <Heading>Stock Sync</Heading>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Trigger Full Sync"}
        </Button>
      </div>

      {loading && <Text>Loading…</Text>}

      {!loading && syncState && (
        <Container
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <Text size="small" weight="plus">
                Status
              </Text>
              <div style={{ marginTop: "0.25rem" }}>
                <Badge color={statusColor(syncState.status)}>
                  {syncState.status}
                </Badge>
              </div>
            </div>
            <div>
              <Text size="small" weight="plus">
                Last Synced
              </Text>
              <Text>
                {syncState.last_synced_at
                  ? new Date(syncState.last_synced_at).toLocaleString("en-IN")
                  : "Never"}
              </Text>
            </div>
            <div>
              <Text size="small" weight="plus">
                Total Synced
              </Text>
              <Text>{syncState.total_synced}</Text>
            </div>
          </div>
        </Container>
      )}

      {!loading && (
        <div>
          <Heading level="h3" style={{ marginBottom: "0.75rem" }}>
            Audit Log
          </Heading>
          {auditLog.length === 0 ? (
            <Text>No audit entries.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Action</Table.HeaderCell>
                  <Table.HeaderCell>Products Synced</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Timestamp</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {auditLog.map((entry) => (
                  <Table.Row key={entry.id}>
                    <Table.Cell>{entry.action}</Table.Cell>
                    <Table.Cell>{entry.products_count}</Table.Cell>
                    <Table.Cell>
                      <Badge color={auditColor(entry.status)}>
                        {entry.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {new Date(entry.synced_at).toLocaleString("en-IN")}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Stock Sync",
  icon: ArrowPath,
})

export default StockSyncPage
