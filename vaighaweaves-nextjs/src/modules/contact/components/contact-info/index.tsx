export default function ContactInfo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Get in Touch</h2>
        <p className="text-ui-fg-subtle">
          We&apos;d love to hear from you. Reach out to us through any of the
          channels below.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="text-ui-fg-subtle mt-0.5">📍</span>
          <div>
            <p className="font-medium">Address</p>
            <p className="text-ui-fg-subtle text-sm">
              VaighaWeaves, Handloom Nagar,
              <br />
              Hyderabad, Telangana – 500001
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-ui-fg-subtle mt-0.5">📞</span>
          <div>
            <p className="font-medium">Phone</p>
            <a
              href="tel:+919876543210"
              className="text-ui-fg-subtle text-sm hover:text-ui-fg-base transition-colors"
            >
              +91 98765 43210
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-ui-fg-subtle mt-0.5">✉️</span>
          <div>
            <p className="font-medium">Email</p>
            <a
              href="mailto:support@vaighaweaves.com"
              className="text-ui-fg-subtle text-sm hover:text-ui-fg-base transition-colors"
            >
              support@vaighaweaves.com
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-ui-fg-subtle mt-0.5">🕐</span>
          <div>
            <p className="font-medium">Business Hours</p>
            <p className="text-ui-fg-subtle text-sm">
              Monday – Saturday: 9:00 AM – 6:00 PM IST
              <br />
              Sunday: Closed
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
