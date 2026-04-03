import nodemailer from 'nodemailer'

export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim()
  return Boolean(host && user && pass && from)
}

/** Default true. Set SMTP_TLS_REJECT_UNAUTHORIZED=false only when TLS fails with "self-signed certificate in certificate chain" (often local AV/proxy SSL inspection). Do not use in production unless you understand the risk. */
function tlsRejectUnauthorized(): boolean {
  const v = process.env.SMTP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase()
  if (v === 'false' || v === '0') return false
  return true
}

function createTransport() {
  const host = process.env.SMTP_HOST!.trim()
  const port = Number(process.env.SMTP_PORT ?? '587') || 587
  const secure =
    process.env.SMTP_SECURE === 'true' || port === 465
  const user = process.env.SMTP_USER!.trim()
  const pass = process.env.SMTP_PASS!.trim()

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: tlsRejectUnauthorized(),
      servername: host,
    },
  })
}

export async function sendSmtpMail(params: {
  to: string
  subject: string
  text: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: 'SMTP is not configured' }
  }
  const from = process.env.SMTP_FROM!.trim()
  try {
    const transport = createTransport()
    await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: withSmtpAuthHint(msg) }
  }
}

function withSmtpAuthHint(msg: string): string {
  if (/535|authentication failed|invalid login/i.test(msg)) {
    return `${msg} — Verify SMTP_USER is the full mailbox address, SMTP_PASS matches Private Email webmail (no quotes/spaces in .env), and SMTP is enabled for that mailbox in Namecheap. Reset the mailbox password if unsure.`
  }
  return msg
}
