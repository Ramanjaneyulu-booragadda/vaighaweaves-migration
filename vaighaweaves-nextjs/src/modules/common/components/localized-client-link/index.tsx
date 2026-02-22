"use client"

import Link from "next/link"
import React from "react"

/**
 * Thin wrapper around Next.js Link.
 * VaighaWeaves does not use countryCode-prefixed routing, so hrefs are used as-is.
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: any
}) => {
  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
