import { render } from '@react-email/components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BillingReminderEmail } from './billing-reminder'
import { PasswordResetEmail } from './password-reset'
import { PaymentReceivedEmail } from './payment-received'
import { RequestStatusUpdateEmail } from './request-status-update'
import { SubscriptionCancelledEmail } from './subscription-cancelled'
import { WelcomeEmail } from './welcome'

const RESET_LINK = 'https://example.test/reset?token=abc'

function buildTemplates(baseUrl?: string) {
  return {
    welcome: WelcomeEmail({ userName: 'Ana', baseUrl }),
    paymentReceived: PaymentReceivedEmail({
      amount: '$40.00',
      planName: 'Hosting',
      paymentDate: 'Sep 24, 2026',
      baseUrl,
    }),
    requestStatus: RequestStatusUpdateEmail({
      businessName: 'Test Co',
      newStatus: 'in_review',
      baseUrl,
    }),
    subscriptionCancelled: SubscriptionCancelledEmail({
      planName: 'Hosting',
      endDate: 'Oct 25, 2026',
      baseUrl,
    }),
    billingReminder: BillingReminderEmail({
      planName: 'Hosting',
      amount: '$40.00',
      billingDate: 'Oct 25, 2026',
      daysUntilBilling: 3,
      baseUrl,
    }),
    passwordReset: PasswordResetEmail({ resetLink: RESET_LINK, baseUrl }),
  }
}

type TemplateName = keyof ReturnType<typeof buildTemplates>
const names = Object.keys(buildTemplates()) as TemplateName[]

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('email templates', () => {
  it.each(names)('%s links only to the configured base URL', async (name) => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test/')
    const html = await render(buildTemplates()[name])
    // The unregistered domain must never appear as a link or address.
    expect(html).not.toMatch(/https?:\/\/(www\.)?freeplug\.dev|@freeplug\.dev/i)
    // Brand text is plain "Freeplug" (no ".dev" suffix, no "freeplug.in"): those name domains we don't own.
    expect(html).not.toMatch(/freeplug\.dev/i)
    expect(html).not.toMatch(/freeplug\.in\b(?!-)/i)
    expect(html).toContain('Freeplug')
    const links = hrefs(html)
    expect(links).toContain('https://app.example.test')
    expect(links).toContain('mailto:support@freeplug-in.dev')
    for (const href of links) {
      const ok =
        href === 'https://app.example.test' ||
        href.startsWith('https://app.example.test/') ||
        href === 'mailto:support@freeplug-in.dev' ||
        href === RESET_LINK
      expect(ok, `unexpected href ${href}`).toBe(true)
    }
  })

  it('prefers an explicit baseUrl over NEXT_PUBLIC_APP_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test')
    const links = hrefs(await render(buildTemplates('http://localhost:3000').welcome))
    expect(links).toContain('http://localhost:3000/dashboard')
    expect(links).toContain('http://localhost:3000')
  })

  it('falls back to https://freeplug-in.dev when no base URL is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    const links = hrefs(await render(buildTemplates().billingReminder))
    expect(links).toContain('https://freeplug-in.dev/dashboard')
    expect(links).toContain('https://freeplug-in.dev/dashboard/cancel')
    expect(links).toContain('https://freeplug-in.dev')
  })
})

describe('subscription cancelled email copy (Sable, Sep 25 2026)', () => {
  it('uses the new text and links the button to the dashboard', async () => {
    const { render } = await import('@react-email/components')
    const html = await render(
      SubscriptionCancelledEmail({ endDate: 'Oct 25, 2026', baseUrl: 'https://freeplug-in.dev' })
    )
    const text = html.replace(/<!-- -->/g, '').replace(/<\/?strong>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ')
    expect(text).toContain('Your hosting plan is canceled.')
    expect(text).toContain('Your website stays online until Oct 25, 2026, then goes offline.')
    expect(text).toContain(
      "Until Oct 25, 2026, you can resume your plan from your dashboard. After that, choose Restart hosting in your dashboard and we'll bring your website back."
    )
    expect(text).toContain('Go to your dashboard')
    expect(html).toContain('href="https://freeplug-in.dev/dashboard"')
    expect(text).not.toMatch(/Invalid Date|Resume Your Plan/)
  })
})

