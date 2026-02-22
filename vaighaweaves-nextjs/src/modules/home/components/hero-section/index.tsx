"use client"

import dynamic from "next/dynamic"

const HeroSwiper = dynamic(() => import("./hero-swiper"), { ssr: false })

const HERO_SLIDES = [
  {
    id: "1",
    title: "Premium Handloom Sarees",
    subtitle: "Authentic weaves from master artisans",
    cta: "Shop Now",
    href: "/shop",
    bg: "from-primary/80 to-primary/60",
  },
  {
    id: "2",
    title: "Silk Sarees Collection",
    subtitle: "Luxurious silk sarees for every occasion",
    cta: "Explore Collection",
    href: "/categories/silk-sarees",
    bg: "from-gold/80 to-gold/60",
  },
  {
    id: "3",
    title: "New Arrivals",
    subtitle: "Discover the latest handloom designs",
    cta: "View New Arrivals",
    href: "/shop?sort=created_at",
    bg: "from-gray-800/80 to-gray-700/60",
  },
]

export default function HeroSection() {
  return (
    <section className="relative w-full h-[60vh] min-h-[400px] max-h-[700px]">
      <HeroSwiper slides={HERO_SLIDES} />
    </section>
  )
}
