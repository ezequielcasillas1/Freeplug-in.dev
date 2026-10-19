/**
 * Aria's Spanish legal line (9:53 AM CT; Sable's English fixes §7 item 14, key
 * common.legal.translationNotice). Pinned word for word; shown in the footer of every Spanish page
 * and NEVER on checkout.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTestLocale } from '../../../test/intl-mock'

vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({ openBillingPortal: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import { TranslationNotice, TRANSLATION_NOTICE_KEY } from './TranslationNotice'
import { Footer } from '@/features/landing/components/Footer'
import { AuthFrame } from '@/app/(auth)/AuthFrame'
import { HostingCheckoutCard } from '@/components/plans/HostingCheckoutCard'
import { applyUserToCheckoutSession } from '@/lib/stripe/checkout-context'

const ES_LINE = 'Traducción para tu conveniencia; la versión en inglés prevalece.'
const EN_LINE = 'Translation provided for your convenience; the English version prevails.'
const ROOT = join(__dirname, '..', '..', '..')

beforeEach(() => {
  vi.stubEnv('FREEPLUG_I18N_ES_ALLOW_PENDING', '1')
  // framer-motion whileInView (Footer) needs an IntersectionObserver; jsdom has none.
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
})
afterEach(() => {
  setTestLocale('en')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('legal line: exact text', () => {
  it('es and en catalogs carry Sable/Aria text word for word', () => {
    expect(TRANSLATION_NOTICE_KEY).toBe('common.legal.translationNotice')
    expect(es.common.legal.translationNotice).toBe(ES_LINE)
    expect(en.common.legal.translationNotice).toBe(EN_LINE)
  })
})

describe('legal line: where it shows', () => {
  it('Spanish pages: once in the landing footer', () => {
    setTestLocale('es')
    render(<Footer />)
    expect(screen.getAllByText(ES_LINE)).toHaveLength(1)
  })

  it('Spanish sign-up / auth pages (no landing footer): under the card', () => {
    setTestLocale('es')
    render(<AuthFrame><p>form</p></AuthFrame>)
    expect(screen.getByTestId('translation-notice')).toHaveTextContent(ES_LINE)
  })

  it('English pages: never (neither the Spanish nor the English value)', () => {
    const { container } = render(
      <>
        <Footer />
        <AuthFrame><p>form</p></AuthFrame>
        <TranslationNotice />
      </>
    )
    expect(screen.queryByTestId('translation-notice')).toBeNull()
    expect(container.textContent).not.toContain(ES_LINE)
    expect(container.textContent).not.toContain(EN_LINE)
  })
})

describe('legal line: NEVER on checkout', () => {
  it('the Plans/checkout card in Spanish does not show it', () => {
    setTestLocale('es')
    const { container } = render(<HostingCheckoutCard />)
    expect(screen.queryByTestId('translation-notice')).toBeNull()
    expect(container.textContent).not.toContain(ES_LINE)
  })

  it('Stripe Checkout params in Spanish do not carry it (no custom_text / terms text)', () => {
    vi.stubEnv('NEXT_PUBLIC_FREEPLUG_I18N_ES', 'on')
    const params = applyUserToCheckoutSession(
      { mode: 'subscription', line_items: [] },
      {
        paths: { base: 'http://127.0.0.1:3371', successPath: '/dashboard', cancelPath: '/dashboard/plans' },
        user: { id: 'u1', email: 'owner@example.test' },
        stripeCustomerId: 'cus_test',
        locale: 'es',
      } as never,
      {}
    )
    const json = JSON.stringify(params)
    expect(json).not.toContain(ES_LINE)
    expect(json).not.toContain(EN_LINE)
    expect(json).not.toContain('custom_text')
  })

  it('no checkout source file renders or references it', () => {
    const CHECKOUT = [
      'src/app/claim',
      'src/app/api/checkout',
      'src/app/(dashboard)/dashboard/plans',
      'src/components/plans',
      'src/lib/stripe',
      'src/lib/plans',
    ]
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
          const src = readFileSync(p, 'utf8')
          if (/TranslationNotice|translationNotice|common\.legal|la versión en inglés prevalece|English version prevails/.test(src))
            offenders.push(relative(ROOT, p))
          // The claim flow is checkout: it must not pull in a frame that carries the line.
          if (/from '@\/features\/landing\/components\/Footer'|from '@\/features\/landing'|AuthFrame/.test(src) && p.includes(join('src', 'app', 'claim')))
            offenders.push(`${relative(ROOT, p)} (footer/auth frame on checkout)`)
        }
      }
    }
    for (const d of CHECKOUT) if (existsSync(join(ROOT, d))) walk(join(ROOT, d))
    expect(offenders).toEqual([])
  })
})

describe('legal line: Terms and Privacy (once Spanish versions exist)', () => {
  it('any terms/privacy page renders the notice (none exist yet: both are "coming soon")', () => {
    const pages: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (name === 'page.tsx' && /(terms|privacy)/i.test(relative(join(ROOT, 'src', 'app'), p))) pages.push(p)
      }
    }
    walk(join(ROOT, 'src', 'app'))
    for (const p of pages) expect(readFileSync(p, 'utf8'), relative(ROOT, p)).toContain('<TranslationNotice')
  })
})
