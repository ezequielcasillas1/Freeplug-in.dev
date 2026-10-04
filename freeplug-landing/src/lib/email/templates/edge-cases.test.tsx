// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { ReactElement } from 'react'
import { render, toPlainText } from '@react-email/components'
import { describe, expect, it } from 'vitest'
import { EMAIL_LOCALES } from '../locales'
import { AddonRefundedEmail } from './addon-refunded'
import { BillingReminderEmail } from './billing-reminder'
import { GoogleSignInEmail } from './google-sign-in'
import { PasswordResetEmail } from './password-reset'
import { PaymentReceivedEmail } from './payment-received'
import { RequestStatusUpdateEmail } from './request-status-update'
import { SubscriptionCancelledEmail } from './subscription-cancelled'
import { WelcomeEmail } from './welcome'

/**
 * Template CI (Aria, round 5): every email template the app sends through Resend renders, for every enabled
 * locale (src/lib/email/locales.ts; English-only today), with edge-case inputs. A template that throws, or
 * a new template that isn't listed here, fails vitest (and so CI).
 */
const LONG = 'A'.repeat(10_000)
const TEXTS: Record<string, string | undefined> = {
  missing: undefined,
  empty: '',
  blank: '   ',
  long: LONG,
  unicode: 'Zoë Ñúñez-Łódź 李小龍 Ærøskøbing',
  rtl: 'محمد العربي \u200f שלום',
  emoji: '👩🏽‍💻🔥🏳️‍🌈 ✨',
  special: `<script>alert("x")</script> & 'q' "dq" \\ \${x} {{x}} <b>bold</b> %s %n`,
}
const REQUIRED = Object.fromEntries(Object.entries(TEXTS).map(([k, v]) => [k, v ?? ''])) as Record<string, string>
const RESET_LINKS = [
  'https://app.example.test/auth/confirm?token_hash=abc&type=recovery&next=/reset-password',
  `https://app.example.test/auth/confirm?token_hash=${'f'.repeat(512)}&type=recovery&next=%2Freset-password%3Fa%3D1%26b%3D%3C%3E`,
]

type Case = { template: string; variant: string; el: () => ReactElement; expectText?: string }

function cases(): Case[] {
  const out: Case[] = []
  for (const [variant, name] of Object.entries(TEXTS)) {
    const req = REQUIRED[variant]
    out.push({ template: 'welcome', variant, el: () => WelcomeEmail({ userName: name }) })
    out.push({
      template: 'payment-received',
      variant,
      el: () => PaymentReceivedEmail(
        variant === 'missing'
          ? { amount: '$40.00', planName: 'Hosting', paymentDate: 'Oct 3, 2026' }
          : {
              userName: name,
              amount: variant === 'long' ? `$${'9'.repeat(400)}.00` : '$1,000,000.00',
              planName: req,
              invoiceNumber: req,
              paymentDate: req,
              nextBillingDate: req,
              totalPaidToDate: req,
            }
      ),
    })
    for (const newStatus of ['submitted', 'in_review', 'closed'] as const) {
      out.push({
        template: 'request-status-update',
        variant: `${variant}/${newStatus}`,
        el: () => RequestStatusUpdateEmail(
          variant === 'missing' ? { businessName: 'Test Co', newStatus } : { userName: name, businessName: req, newStatus, message: req }
        ),
      })
    }
    out.push({
      template: 'subscription-cancelled',
      variant,
      el: () => SubscriptionCancelledEmail(
        variant === 'missing' ? { endDate: 'Oct 25, 2026' } : { userName: name, planName: req, endDate: req, totalPaidToDate: req }
      ),
    })
    for (const daysUntilBilling of [0, 1, -1, 365]) {
      out.push({
        template: 'billing-reminder',
        variant: `${variant}/${daysUntilBilling}d`,
        el: () => BillingReminderEmail({ userName: name, planName: req, amount: req || '$0.00', billingDate: req, daysUntilBilling }),
      })
    }
    for (const [i, resetLink] of RESET_LINKS.entries()) {
      out.push({
        template: 'password-reset',
        variant: `${variant}/link${i}`,
        el: () => PasswordResetEmail(variant === 'missing' ? { resetLink } : { resetLink, userName: name, expiresIn: req }),
        expectText: 'reset',
      })
    }
  }
  for (const [variant, name] of Object.entries(TEXTS)) {
    out.push({
      template: 'addon-refunded',
      variant,
      el: () => AddonRefundedEmail({ userName: name, addonName: name ?? 'Big change', note: name ?? 'We refunded $5.75 to your card.' }),
      expectText: "couldn't turn on",
    })
  }
  out.push({ template: 'google-sign-in', variant: 'default', el: () => GoogleSignInEmail({}) })
  out.push({ template: 'google-sign-in', variant: 'baseUrl', el: () => GoogleSignInEmail({ baseUrl: 'http://localhost:3000' }) })
  return out
}

const COVERED = ['addon-refunded', 'welcome', 'payment-received', 'request-status-update', 'subscription-cancelled', 'billing-reminder', 'password-reset', 'google-sign-in']

describe.each(EMAIL_LOCALES)('every email template renders with edge-case inputs (locale %s)', () => {
  it.each(cases().map((c) => [`${c.template} [${c.variant}]`, c] as const))('%s', async (_label, c) => {
    const html = await render(c.el())
    expect(typeof html).toBe('string')
    expect(html).toMatch(/<\/html>\s*$/)
    expect(html).toContain('Freeplug')
    // User-supplied text is escaped, never live markup.
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<b>bold</b>')
    const text = toPlainText(html)
    expect(text.trim().length).toBeGreaterThan(20)
    if (c.expectText) expect(text.toLowerCase()).toContain(c.expectText)
  })
})

describe('template coverage', () => {
  it('every *Email template file in this folder is covered above', () => {
    const dir = __dirname
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.includes('.test.') && f !== 'base-layout.tsx')
    const withEmailExport = files.filter((f) => /export function \w+Email\(/.test(readFileSync(path.join(dir, f), 'utf8')))
    expect(withEmailExport.map((f) => f.replace(/\.tsx$/, '')).sort()).toEqual([...COVERED].sort())
  })

  it("addon-refunded (Aria 9:27): Sable's subject as the heading, the reason + split line, the help line, Go to Plans", async () => {
    const note = "We couldn't turn on Big change because the billing period you paid for ended before we could add it. We refunded $0.35 to your card and added $5.40 back to your account credit. It can take 5–10 business days to show."
    const text = toPlainText(await render(AddonRefundedEmail({ userName: 'Dana', addonName: 'Big change', note, baseUrl: 'http://localhost:3000' })))
    expect(text).toContain("We couldn't turn on Big change")
    expect(text).toContain('Hi Dana,')
    expect(text).toContain(note)
    expect(text).toContain('Questions? Email support@freeplug-in.dev.')
    expect(text).toContain('Go to Plans')
    expect(await render(AddonRefundedEmail({ addonName: 'Big change', note, baseUrl: 'http://localhost:3000' }))).toContain('http://localhost:3000/dashboard/plans')
  })

  it('the password-reset template keeps the link intact (escaped only as HTML requires)', async () => {
    const html = await render(PasswordResetEmail({ resetLink: RESET_LINKS[1] }))
    expect(html).toContain(RESET_LINKS[1].replace(/&/g, '&amp;'))
  })
})
