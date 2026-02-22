import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    // ── Phase 1 ──────────────────────────────────────────────────────────
    {
      resolve: "./src/modules/stock-events",
    },
    // ── Phase 2 ──────────────────────────────────────────────────────────
    {
      resolve: "./src/modules/product-metadata",
    },
    {
      resolve: "./src/modules/image-optimizer",
    },
    // ── Pre-Phase 6: Wishlist (uncomment after running db:generate + db:migrate)
    // {
    //   resolve: "./src/modules/wishlist",
    // },
    // ── Phase 3: Webhook Monitor ─────────────────────────────────────────
    {
      resolve: "./src/modules/webhook-monitor",
    },
    // ── Phase 3: Razorpay Payment Provider ───────────────────────────────
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/payment-razorpay",
            id: "razorpay",
            options: {
              key_id: process.env.RAZORPAY_KEY_ID!,
              key_secret: process.env.RAZORPAY_KEY_SECRET!,
              webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
              auto_capture: true,
            },
          },
        ],
      },
    },
    // ── Phase 3: India Post Fulfillment Provider ─────────────────────────
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "./src/modules/fulfillment-indian-carriers",
            id: "indian-carriers",
            options: {
              india_post: {
                api_url: process.env.INDIA_POST_API_URL || "https://bext.cept.gov.in/beextcustomer",
                customer_id: process.env.INDIA_POST_CUSTOMER_ID || "",
                password: process.env.INDIA_POST_PASSWORD || "",
                sender_name: process.env.INDIA_POST_SENDER_NAME || "VaighaWeaves",
                sender_address: process.env.INDIA_POST_SENDER_ADDRESS || "",
                sender_pincode: process.env.INDIA_POST_SENDER_PINCODE || "500001",
                sender_phone: process.env.INDIA_POST_SENDER_PHONE || "",
              },
            },
          },
        ],
      },
    },
  ],
})
