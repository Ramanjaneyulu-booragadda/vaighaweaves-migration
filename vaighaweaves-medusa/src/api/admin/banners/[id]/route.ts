import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { banners } from "../store"

type BannerUpdateBody = {
  title?: string
  image_url?: string
  link_url?: string
  position?: number
  active?: boolean
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const banner = banners.find((b) => b.id === id)
  if (!banner) {
    res.status(404).json({ message: "Banner not found" })
    return
  }
  res.json({ banner })
}

export async function PUT(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const index = banners.findIndex((b) => b.id === id)
  if (index === -1) {
    res.status(404).json({ message: "Banner not found" })
    return
  }
  const body = req.body as BannerUpdateBody
  const existing = banners[index]
  const updated = {
    ...existing,
    title: body.title ?? existing.title,
    image_url: body.image_url ?? existing.image_url,
    link_url: body.link_url ?? existing.link_url,
    position: body.position ?? existing.position,
    active: body.active ?? existing.active,
  }
  banners[index] = updated
  res.json({ banner: updated })
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const index = banners.findIndex((b) => b.id === id)
  if (index === -1) {
    res.status(404).json({ message: "Banner not found" })
    return
  }
  banners.splice(index, 1)
  res.json({ deleted: true, id })
}
