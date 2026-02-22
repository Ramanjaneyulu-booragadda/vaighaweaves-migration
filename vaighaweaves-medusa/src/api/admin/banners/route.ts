import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { banners, type Banner } from "./store"

type BannerBody = {
  title: string
  image_url: string
  link_url: string
  position: number
  active: boolean
}

export async function GET(
  _req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.json({ banners })
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const body = req.body as BannerBody
  const banner: Banner = {
    id: `ban_${crypto.randomUUID()}`,
    title: body.title ?? "",
    image_url: body.image_url ?? "",
    link_url: body.link_url ?? "",
    position: body.position ?? 0,
    active: body.active ?? true,
    created_at: new Date().toISOString(),
  }
  banners.push(banner)
  res.json({ banner })
}
