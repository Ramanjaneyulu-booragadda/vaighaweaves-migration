export type Banner = {
  id: string
  title: string
  image_url: string
  link_url: string
  position: number
  active: boolean
  created_at: string
}

export const banners: Banner[] = []
