/**
 * Authentication helpers for both old Express and new Medusa systems.
 * Obtains JWT tokens at runtime for admin and customer API access.
 */

import axios from "axios"
import * as dotenv from "dotenv"

dotenv.config()

const OLD_API = process.env.OLD_API_URL || "http://localhost:5001/api"
const NEW_API = process.env.NEW_API_URL || "http://localhost:9000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@vaighaweaves.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"
const PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY || ""

let cachedOldToken: string | null = null
let cachedMedusaToken: string | null = null

/**
 * Get admin JWT from old Express system.
 * POST /api/auth/login → { success, data: { token } }
 */
export async function getOldAdminToken(): Promise<string> {
  if (cachedOldToken) return cachedOldToken

  const response = await axios.post(`${OLD_API}/auth/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })

  const token = response.data.data?.token || response.data.token
  if (!token) {
    throw new Error("Failed to get old admin token: " + JSON.stringify(response.data))
  }

  cachedOldToken = token
  return token
}

/**
 * Get admin JWT from Medusa system.
 * POST /auth/user/emailpass → { token }
 */
export async function getMedusaAdminToken(): Promise<string> {
  if (cachedMedusaToken) return cachedMedusaToken

  const response = await axios.post(`${NEW_API}/auth/user/emailpass`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })

  const token = response.data.token
  if (!token) {
    throw new Error("Failed to get Medusa admin token: " + JSON.stringify(response.data))
  }

  cachedMedusaToken = token
  return token
}

/**
 * Create axios instance with admin auth for old Express system.
 */
export async function oldAdminClient() {
  const token = await getOldAdminToken()
  return axios.create({
    baseURL: OLD_API,
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * Create axios instance with admin auth for Medusa.
 */
export async function medusaAdminClient() {
  const token = await getMedusaAdminToken()
  return axios.create({
    baseURL: NEW_API,
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * Create axios instance for Medusa store API (requires publishable key).
 */
export function medusaStoreClient() {
  return axios.create({
    baseURL: NEW_API,
    headers: {
      "x-publishable-api-key": PUBLISHABLE_KEY,
    },
  })
}

/**
 * Clear cached tokens (useful if tokens expire mid-test).
 */
export function clearTokenCache() {
  cachedOldToken = null
  cachedMedusaToken = null
}
