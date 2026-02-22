import { Metadata } from "next"
import VideosTemplate from "@modules/videos/templates"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Saree Styling Videos — VaighaWeaves",
  description:
    "Watch how to drape and style handloom sarees with our expert styling tutorials and video guides.",
}

const staticVideos = [
  {
    id: "1",
    videoId: "dQw4w9WgXcQ",
    title: "How to Drape a Kanjivaram Silk Saree",
    description:
      "Step-by-step guide to draping our premium Kanjivaram silk sarees.",
  },
  {
    id: "2",
    videoId: "dQw4w9WgXcQ",
    title: "Pochampally Ikat Saree Styling Tips",
    description:
      "Modern styling ideas for the classic Pochampally Ikat weave.",
  },
  {
    id: "3",
    videoId: "dQw4w9WgXcQ",
    title: "Banarasi Saree — Traditional Nivi Drape",
    description: "Learn the traditional Nivi style draping for Banarasi sarees.",
  },
]

export default async function VideosPage() {
  // TODO: Replace static data with API fetch when Medusa endpoint is ready:
  // const { videos } = await fetch(`${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/videos`).then(r => r.json())
  const videos = staticVideos

  return <VideosTemplate videos={videos} />
}
