/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      ...(process.env.NEXT_PUBLIC_CDN_HOSTNAME
        ? [{ protocol: "https", hostname: process.env.NEXT_PUBLIC_CDN_HOSTNAME }]
        : []),
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: { allowedOrigins: ["vaighaweaves.com"] },
  },
}

module.exports = nextConfig
