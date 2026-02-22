"use client"

import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination, Navigation, A11y } from "swiper/modules"
import Link from "next/link"

import "swiper/css"
import "swiper/css/pagination"
import "swiper/css/navigation"

type HeroSlide = {
  id: string
  title: string
  subtitle: string
  cta: string
  href: string
  bg: string
}

type HeroSwiperProps = {
  slides: HeroSlide[]
}

export default function HeroSwiper({ slides }: HeroSwiperProps) {
  return (
    <Swiper
      modules={[Autoplay, Pagination, Navigation, A11y]}
      spaceBetween={0}
      slidesPerView={1}
      loop
      autoplay={{ delay: 4000, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      navigation
      className="w-full h-full"
    >
      {slides.map((slide) => (
        <SwiperSlide key={slide.id}>
          <div
            className={`w-full h-full bg-gradient-to-r ${slide.bg} flex items-center justify-center text-white`}
          >
            <div className="text-center px-4">
              <h1 className="text-3xl md:text-5xl font-bold mb-4">
                {slide.title}
              </h1>
              <p className="text-lg md:text-xl mb-8 opacity-90">
                {slide.subtitle}
              </p>
              <Link
                href={slide.href}
                className="inline-block bg-white text-gray-900 font-semibold px-8 py-3 rounded-full hover:bg-gray-100 transition-colors"
              >
                {slide.cta}
              </Link>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}
