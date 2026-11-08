import { sendMail } from '@/lib/email/mailer'
import { appBaseUrl } from '@/lib/stripe/config'

export async function sendMerchDownloadEmail(opts: {
  to: string
  downloadUrl: string
  expiresAtIso: string
}): Promise<{ sent: boolean }> {
  const expires = new Date(opts.expiresAtIso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Chicago',
  })
  const res = await sendMail({
    to: opts.to,
    subject: 'Your Freeplug Font Bundle download',
    react: (
      <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, color: '#111' }}>
        <p>Thanks for your purchase.</p>
        <p>
          Download your bundle (link expires about {expires} Central, limited uses):
        </p>
        <p>
          <a href={opts.downloadUrl}>{opts.downloadUrl}</a>
        </p>
        <p style={{ fontSize: 14, color: '#555' }}>
          License: personal use, websites, and client work are allowed. Do not redistribute or resell the font
          files. These typefaces were designed with the help of AI tools and refined by Freeplug.
        </p>
        <p style={{ fontSize: 14, color: '#555' }}>
          Questions? Reply to this email or write support@freeplug-in.dev.
        </p>
      </div>
    ),
  })
  return { sent: res.success }
}

export function merchDownloadUrl(token: string): string {
  const base = appBaseUrl()
  return `${base}/api/merch/download?token=${encodeURIComponent(token)}`
}

export async function sendMerchCollectionOrderEmail(opts: {
  to: string
  title: string
  optionLabel: string
  quantity: number
}): Promise<{ sent: boolean }> {
  const res = await sendMail({
    to: opts.to,
    subject: 'Your Freeplug merch order',
    react: (
      <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, color: '#111' }}>
        <p>Thanks for your order.</p>
        <p>
          <strong>{opts.title}</strong>
          <br />
          {opts.optionLabel} · Qty {opts.quantity}
        </p>
        <p style={{ fontSize: 14, color: '#555' }}>
          Printed to order in the USA. We will email tracking when your order ships (usually within 2–10 business days
          after production).
        </p>
        <p style={{ fontSize: 14, color: '#555' }}>
          Questions? Reply to this email or write support@freeplug-in.dev.
        </p>
      </div>
    ),
  })
  return { sent: res.success }
}

export async function sendMerchShirtOrderEmail(opts: {
  to: string
  title: string
  color: string
  size: string
  quantity: number
}): Promise<{ sent: boolean }> {
  const res = await sendMail({
    to: opts.to,
    subject: 'Your Freeplug t-shirt order',
    react: (
      <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, color: '#111' }}>
        <p>Thanks for your order.</p>
        <p>
          <strong>{opts.title}</strong>
          <br />
          {opts.color} · {opts.size} · Qty {opts.quantity}
        </p>
        <p style={{ fontSize: 14, color: '#555' }}>
          Printed to order in the USA. We will email tracking when your shirt ships (usually within 2–7 business days
          after production).
        </p>
        <p style={{ fontSize: 14, color: '#555' }}>
          Questions? Reply to this email or write support@freeplug-in.dev.
        </p>
      </div>
    ),
  })
  return { sent: res.success }
}
