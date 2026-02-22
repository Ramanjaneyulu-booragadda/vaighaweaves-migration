"use client"

import { useState } from "react"

type VideoPlayerProps = {
  videoId: string
  title: string
  thumbnail?: string
}

export default function VideoPlayer({ videoId, title, thumbnail }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false)

  const thumbnailUrl =
    thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  if (playing) {
    return (
      <div className="relative w-full aspect-video">
        <iframe
          className="absolute inset-0 w-full h-full rounded-lg"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative w-full aspect-video group rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-fg-base"
      aria-label={`Play ${title}`}
    >
      {/* Thumbnail */}
      <img
        src={thumbnailUrl}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <svg
            className="w-7 h-7 text-gray-800 ml-1"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  )
}
