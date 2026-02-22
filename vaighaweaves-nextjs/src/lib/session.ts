import { cookies } from "next/headers"

export async function getSession(): Promise<string | null> {
  const token = (await cookies()).get("_medusa_jwt")?.value
  return token ?? null
}

export async function getServerCustomer() {
  const token = await getSession()
  if (!token) return null
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/customers/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-publishable-api-key": process.env.NEXT_PUBLIC_PUBLISHABLE_KEY!,
      },
      cache: "no-store",
    }
  )
  if (!res.ok) return null
  return (await res.json()).customer
}
