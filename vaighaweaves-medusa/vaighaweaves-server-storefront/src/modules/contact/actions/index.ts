"use server"

export async function submitContactForm(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const subject = formData.get("subject") as string
  const message = formData.get("message") as string

  // TODO: Replace with your preferred transport (nodemailer, resend, Medusa custom endpoint, etc.)
  // Intentionally not logging user-submitted data to avoid leaking PII in production logs.
  void { name, email, subject, message }
}
