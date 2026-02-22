import { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Badge,
  Input,
  Label,
  Switch,
  Table,
  Text,
} from "@medusajs/ui"

type Banner = {
  id: string
  title: string
  image_url: string
  link_url: string
  position: number
  active: boolean
  created_at: string
}

type BannersResponse = {
  banners: Banner[]
}

type BannerCreateResponse = {
  banner: Banner
}

type FormState = {
  title: string
  image_url: string
  link_url: string
  position: string
  active: boolean
}

const emptyForm = (): FormState => ({
  title: "",
  image_url: "",
  link_url: "",
  position: "0",
  active: true,
})

function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/admin/banners")
      .then((r) => r.json())
      .then((data: BannersResponse) => setBanners(data.banners ?? []))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false))
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  const openEdit = (banner: Banner) => {
    setEditingId(banner.id)
    setForm({
      title: banner.title,
      image_url: banner.image_url,
      link_url: banner.link_url,
      position: String(banner.position),
      active: banner.active,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      title: form.title,
      image_url: form.image_url,
      link_url: form.link_url,
      position: parseInt(form.position) || 0,
      active: form.active,
    }
    try {
      if (editingId) {
        const res = await fetch(`/admin/banners/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json()) as BannerCreateResponse
        setBanners((prev) =>
          prev.map((b) => (b.id === editingId ? data.banner : b))
        )
      } else {
        const res = await fetch("/admin/banners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json()) as BannerCreateResponse
        setBanners((prev) => [...prev, data.banner])
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm())
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/admin/banners/${id}`, { method: "DELETE" })
      setBanners((prev) => prev.filter((b) => b.id !== id))
    } catch {
      // silent
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
        <Heading>Banners</Heading>
        <Button onClick={openCreate}>+ Create Banner</Button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <Container
          style={{
            marginBottom: "1.5rem",
            padding: "1.25rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
        >
          <Heading level="h3" style={{ marginBottom: "1rem" }}>
            {editingId ? "Edit Banner" : "New Banner"}
          </Heading>
          <div style={{ display: "grid", gap: "0.875rem", maxWidth: "480px" }}>
            <div>
              <Label>Title</Label>
              <Input
                placeholder="Banner title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input
                placeholder="https://…"
                value={form.image_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, image_url: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Link URL</Label>
              <Input
                placeholder="https://…"
                value={form.link_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, link_url: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Position</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.position}
                onChange={(e) =>
                  setForm((f) => ({ ...f, position: e.target.value }))
                }
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Label>Active</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setForm(emptyForm())
              }}
            >
              Cancel
            </Button>
          </div>
        </Container>
      )}

      {loading ? (
        <Text>Loading…</Text>
      ) : banners.length === 0 ? (
        <Text>No banners found. Create your first banner above.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Preview</Table.HeaderCell>
              <Table.HeaderCell>Title</Table.HeaderCell>
              <Table.HeaderCell>Link</Table.HeaderCell>
              <Table.HeaderCell>Position</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {banners.map((banner) => (
              <Table.Row key={banner.id}>
                <Table.Cell>
                  {banner.image_url ? (
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      style={{
                        width: "64px",
                        height: "40px",
                        objectFit: "cover",
                        borderRadius: "0.25rem",
                      }}
                    />
                  ) : (
                    <Text size="small">—</Text>
                  )}
                </Table.Cell>
                <Table.Cell>{banner.title}</Table.Cell>
                <Table.Cell>
                  {banner.link_url ? (
                    <a
                      href={banner.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#1a4731" }}
                    >
                      {banner.link_url.length > 30
                        ? `${banner.link_url.slice(0, 30)}…`
                        : banner.link_url}
                    </a>
                  ) : (
                    "—"
                  )}
                </Table.Cell>
                <Table.Cell>{banner.position}</Table.Cell>
                <Table.Cell>
                  <Badge color={banner.active ? "green" : "grey"}>
                    {banner.active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => openEdit(banner)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="danger"
                      onClick={() => handleDelete(banner.id)}
                    >
                      Delete
                    </Button>
                  </div>
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
  label: "Banners",
  icon: Photo,
})

export default BannersPage
