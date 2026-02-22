"use client"

import { Swiper, SwiperSlide } from "swiper/react"
import { Thumbs, Zoom, A11y } from "swiper/modules"
import type { Swiper as SwiperType } from "swiper"
import Image from "next/image"
import { useEffect, useRef } from "react"

import "swiper/css"
import "swiper/css/zoom"

type ImageSwiperProps = {
  images: Array<{ id: string; url: string }>
  activeIndex: number
  onSlideChange: (index: number) => void
}

export default function ImageSwiper({
  images,
  activeIndex,
  onSlideChange,
}: ImageSwiperProps) {
  const swiperRef = useRef<SwiperType | null>(null)

  useEffect(() => {
    if (swiperRef.current && swiperRef.current.activeIndex !== activeIndex) {
      swiperRef.current.slideTo(activeIndex)
    }
  }, [activeIndex])

  return (
    <Swiper
      modules={[Zoom, A11y, Thumbs]}
      zoom
      onSwiper={(swiper) => {
        swiperRef.current = swiper
      }}
      onSlideChange={(swiper) => onSlideChange(swiper.activeIndex)}
      className="w-full rounded-xl overflow-hidden bg-gray-100"
    >
      {images.map((image, idx) => (
        <SwiperSlide key={image.id} className="swiper-zoom-container">
          <div className="relative aspect-[3/4] w-full">
            <Image
              src={image.url}
              alt={`Product image ${idx + 1}`}
              fill
              priority={idx === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px"
              className="object-cover"
              placeholder="blur"
              blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 800'%3E%3Crect fill='%23f3f4f6' width='600' height='800'/%3E%3C/svg%3E"
            />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}
