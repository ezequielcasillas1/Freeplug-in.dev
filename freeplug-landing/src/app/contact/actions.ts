'use server'

import { headers } from 'next/headers'
import { sendMail } from '@/lib/email/mailer'
import { verifyTurnstile } from '@/lib/outreach/turnstile'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'
import { CONTACT_ERROR, CONTACT_SUCCESS, contactRecipient, validateContact } from '@/lib/contact/contact'

type Result = { ok: true; message: string } | { ok: false; error: string }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Public contact form: validate, Turnstile, then email support (reply-to = visitor). Nothing stored. */
export async function sendContactAction(input: unknown, turnstileToken: string | null): Promise<Result> {
  const v = validateContact(input)
  if (v.ok === 'honeypot') return { ok: true, message: CONTACT_SUCCESS }
  if (!v.ok) return { ok: false, error: v.error }
  if (!(await verifyTurnstile(turnstileToken, clientIpFrom(await headers())))) {
    return { ok: false, error: 'Please complete the verification check and try again.' }
  }
  const { name, email, message } = v.value
  const res = await sendMail({
    to: contactRecipient(),
    subject: `Contact form: ${name}`,
    replyTo: email,
    template: 'contact-form',
    text: `New contact form message\n\nName: ${name}\nEmail: ${email}\n\n${message}\n`,
    html: `<p><strong>New contact form message</strong></p><p>Name: ${escapeHtml(name)}<br/>Email: ${escapeHtml(email)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  })
  if (!res.success) {
    console.error('[contact] send failed', res.reason)
    return { ok: false, error: CONTACT_ERROR }
  }
  return { ok: true, message: CONTACT_SUCCESS }
}
