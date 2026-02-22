/** @type {import('next-sitemap').IConfig} */
const excludedPaths = [
  "/admin*",
  "/api/*",
  "/auth/*",
  "/payment/*",
  "/dashboard",
  "/orders*",
  "/profile",
  "/wishlist",
  "/cart",
  "/checkout",
  "/maintenance",
  "/dev-gate",
]

module.exports = {
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "https://vaighaweaves.com",
  generateRobotsTxt: true,
  sitemapSize: 5000,
  changefreq: "daily",
  priority: 0.7,
  exclude: excludedPaths.concat(["/[sitemap]"]),
  robotsTxtOptions: {
    policies: [
      { userAgent: "*", allow: "/" },
      {
        userAgent: "*",
        disallow: [
          "/admin",
          "/api",
          "/auth",
          "/checkout",
          "/cart",
          "/dashboard",
          "/orders",
          "/profile",
          "/wishlist",
        ],
      },
    ],
  },
  additionalPaths: async (config) => {
    const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
    const API_KEY = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY
    const headers = { "x-publishable-api-key": API_KEY }

    let productPaths = []
    let categoryPaths = []

    try {
      const { products } = await fetch(
        `${MEDUSA_URL}/store/products?fields=handle,updated_at&limit=500`,
        { headers }
      ).then((r) => r.json())

      productPaths = (products || []).map((p) => ({
        loc: `/product/${p.handle}`,
        changefreq: "daily",
        priority: 0.9,
        lastmod: p.updated_at,
      }))
    } catch (e) {
      console.error("next-sitemap: failed to fetch products", e.message)
    }

    try {
      const { product_categories } = await fetch(
        `${MEDUSA_URL}/store/product-categories?fields=handle,updated_at`,
        { headers }
      ).then((r) => r.json())

      categoryPaths = (product_categories || []).map((c) => ({
        loc: `/categories/${c.handle}`,
        changefreq: "weekly",
        priority: 0.8,
        lastmod: c.updated_at,
      }))
    } catch (e) {
      console.error("next-sitemap: failed to fetch categories", e.message)
    }

    return [
      ...productPaths,
      ...categoryPaths,
      { loc: "/", priority: 1.0, changefreq: "daily" },
      { loc: "/shop", priority: 0.8, changefreq: "daily" },
      { loc: "/videos", priority: 0.7, changefreq: "weekly" },
      { loc: "/about-us", priority: 0.6, changefreq: "monthly" },
      { loc: "/contact", priority: 0.6, changefreq: "monthly" },
      { loc: "/faqs", priority: 0.7, changefreq: "monthly" },
    ]
  },
}
