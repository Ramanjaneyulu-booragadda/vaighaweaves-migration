/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://vaighaweaves.com",
  generateRobotsTxt: true,
  exclude: ["/dashboard", "/profile", "/orders", "/orders/*", "/wishlist", "/payment", "/payment/*"],
}
