/**
 * Spanish build (Oct 12): the signed-in dashboard must not render English when the locale is es.
 * 1. Render check: each dashboard component, rendered in es, shows none of the known English
 *    strings (every en.json value whose Spanish differs), in text, aria-label, title or placeholder.
 * 2. Key coverage: every catalog key the signed-in source files use has a Spanish entry.
 * 3. Spanish dates keep every space non-breaking ("9 de octubre de 2026" with U+00A0).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { setTestLocale } from '../../../../test/intl-mock'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import pending from '../../../../messages/pending-sable.json'
import { QuickStats } from './QuickStats'
import { QuickActions } from './QuickActions'
import { AccountCard } from './AccountCard'
import { SupportCard } from './SupportCard'
import { RecentActivity } from './RecentActivity'
import { YourWebsiteCard } from './YourWebsiteCard'
import { SubscriptionDetails } from './SubscriptionDetails'
import { BuyoutCard, DashboardBuyoutCard } from './BuyoutCard'
import type { ActivityItem, SubscriptionDetail } from './dashboard-actions'
import { DomainRequestForm } from './domain/DomainRequestForm'
import { DashboardPhotoUploader } from './photos/DashboardPhotoUploader'
import { HelpChat } from '@/components/help/HelpChat'
import HelpPage from './help/page'
import { formatDateIn } from '@/i18n/format'
import { formatBillingDate } from '@/lib/stripe/subscription-dates'
import { formatPlanEndDate } from '@/lib/stripe/active-subscription'

vi.mock('./domain/actions', () => ({ requestDomainSetup: vi.fn() }))
vi.mock('./photos/actions', () => ({ startPhotoBatchAction: vi.fn() }))
vi.mock('@/app/claim/actions', () => ({ uploadCustomerPhotoAction: vi.fn() }))

type Tree = { [k: string]: string | Tree }
const flat = (t: Tree, p = ''): Record<string, string> =>
  Object.entries(t).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = p ? `${p}.${k}` : k
    return typeof v === 'string' ? { ...acc, [key]: v } : { ...acc, ...flat(v, key) }
  }, {})
const EN = flat(en as Tree)
const ES = flat(es as Tree)

/** The longest literal run of an ICU message (no placeholders or tags), for matching rendered text. */
const literal = (msg: string) =>
  msg
    .replace(/<\/?\w+>/g, '\u0000')
    .split(/\{[^}]*\}|\u0000/)
    .map((s) => s.trim())
    .sort((a, b) => b.length - a.length)[0] ?? ''

const NAMESPACES = ['dashboard.', 'cancel.', 'help.', 'plans.', 'tips.', 'addons.', 'claim.', 'common.', 'errors.', 'i18n.']
const KNOWN_ENGLISH = Object.entries(EN)
  .filter(([k, v]) => NAMESPACES.some((n) => k.startsWith(n)) && ES[k] && ES[k] !== v && !/, (plural|select),/.test(v))
  .map(([k, v]) => [k, literal(v)] as const)
  .filter(([, lit]) => lit.length >= 14 && lit.includes(' '))

function rendered(container: HTMLElement): string {
  const attrs = [...container.querySelectorAll('[aria-label],[title],[placeholder],[alt]')].flatMap((el) =>
    ['aria-label', 'title', 'placeholder', 'alt'].map((a) => el.getAttribute(a) ?? '')
  )
  return [container.textContent ?? '', ...attrs].join('\n').replace(/\u00A0/g, ' ')
}
const englishIn = (text: string) => KNOWN_ENGLISH.filter(([, lit]) => text.includes(lit)).map(([k, lit]) => `${k}: "${lit}"`)

const plan: SubscriptionDetail = {
  id: 'sub_1',
  productName: 'Starter',
  status: 'active',
  amount: 3500,
  interval: 'month',
  currentPeriodEnd: new Date('2026-10-25T00:00:00Z'),
  currentPeriodStart: new Date('2026-09-25T00:00:00Z'),
  cancelAtPeriodEnd: false,
  created: new Date('2026-09-25T00:00:00Z'),
}
const ending: SubscriptionDetail = { ...plan, id: 'sub_2', status: 'past_due', cancelAtPeriodEnd: true, endsAt: new Date('2026-10-25T00:00:00Z') } as SubscriptionDetail
const payment: ActivityItem = { id: 'p1', type: 'payment', title: 'x', description: 'x', date: new Date(Date.now() - 3 * 86400000), amount: 3500 }
const steps = [
  { label: 'Claimed', state: 'done' as const },
  { label: 'Live', state: 'todo' as const },
] as never
const END = new Date('2026-10-25T00:00:00Z')

const CASES: [string, () => ReactElement][] = [
  ['QuickStats', () => <QuickStats stats={{ totalPaidCents: 3500, activeSubscriptionCount: 1, daysSinceFirstPayment: 12, websiteStatus: 'pending', invoiceCount: 1 }} />],
  ['QuickStats (no payments)', () => <QuickStats stats={{ totalPaidCents: 0, activeSubscriptionCount: 0, daysSinceFirstPayment: null, websiteStatus: 'live', invoiceCount: 0 }} activePlansDash />],
  ['QuickActions', () => <QuickActions canManageBilling />],
  ['QuickActions (no billing)', () => <QuickActions canManageBilling={false} />],
  ['AccountCard', () => <AccountCard email="ezequiel-local@example.test" line={null as never} manageBilling={null} />],
  ['SupportCard', () => <SupportCard />],
  ['RecentActivity', () => <RecentActivity activities={[payment]} />],
  ['RecentActivity (empty)', () => <RecentActivity activities={[]} />],
  ['RecentActivity (failed)', () => <RecentActivity activities={[]} loadFailed />],
  ['YourWebsiteCard', () => <YourWebsiteCard steps={steps} liveUrl={null} showPreview liveNote={null} />],
  ['SubscriptionDetails', () => <SubscriptionDetails subscriptions={[plan, ending]} />],
  ['SubscriptionDetails (none)', () => <SubscriptionDetails subscriptions={[]} />],
  ['BuyoutCard (cancel)', () => <BuyoutCard variant="cancel" alreadyRequested={false} onRequest={vi.fn()} />],
  ['DashboardBuyoutCard (ending)', () => <DashboardBuyoutCard access={{ status: 'ending', accessEndsAt: END, hasHostingHistory: true }} alreadyRequested={false} onRequest={vi.fn()} />],
  ['DashboardBuyoutCard (requested)', () => <DashboardBuyoutCard access={{ status: 'offline', accessEndsAt: null, hasHostingHistory: true }} alreadyRequested onRequest={vi.fn()} />],
  ['DomainRequestForm', () => <DomainRequestForm />],
  ['DashboardPhotoUploader', () => <DashboardPhotoUploader photosUsed={3} />],
  ['HelpChat', () => <HelpChat email="ezequiel-local@example.test" hasIncludedEdit={false} sendRequest={vi.fn()} />],
  ['Help page', () => <HelpPage />],
]

describe('signed-in dashboard in Spanish renders no known English', () => {
  beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }))
  afterEach(() => {
    cleanup()
    setTestLocale('en')
  })
  it('the English list is real (the same components in English do show it)', () => {
    setTestLocale('en')
    const hits = CASES.flatMap(([, el]) => {
      const { container } = render(el())
      const h = englishIn(rendered(container))
      cleanup()
      return h
    })
    expect(KNOWN_ENGLISH.length).toBeGreaterThan(400)
    expect(hits.length).toBeGreaterThan(20)
  })
  it.each(CASES)('%s', (_name, el) => {
    setTestLocale('es')
    const { container } = render(el())
    expect(englishIn(rendered(container))).toEqual([])
  })
})

describe('key coverage: every key the signed-in area uses has Spanish', () => {
  const ROOTS = ['src/app/(dashboard)', 'src/components/plans', 'src/components/help', 'src/components/outreach/PhotoUploadBox.tsx', 'src/lib/outreach/use-photo-copy.ts', 'src/lib/plans/ladder-copy.ts', 'src/lib/help/help-chat-content.ts']
  const base = join(__dirname, '..', '..', '..', '..')
  const files = (p: string): string[] => {
    const abs = join(base, p)
    if (statSync(abs).isFile()) return [abs]
    return readdirSync(abs).flatMap((f) => files(join(p, f)))
  }
  const sources = ROOTS.flatMap(files).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
  const pendingKeys = new Set(Object.keys(pending.addedByOwen))
  const used = new Set<string>()
  for (const f of sources) {
    const src = readFileSync(f, 'utf8')
    const namespaces = [...src.matchAll(/(?:useTranslations|getTranslations)\(\s*'([\w.]+)'/g)].map((m) => m[1])
    for (const m of src.matchAll(/'([a-z][\w]*(?:\.[\w]+)+)'|`([a-z][\w]*(?:\.[\w]+)+)\./g)) {
      const lit = m[1] ?? m[2]
      if (EN[lit]) used.add(lit)
      for (const ns of namespaces) if (EN[`${ns}.${lit}`]) used.add(`${ns}.${lit}`)
      // Dynamic `${prefix}.${id}`: every key under the prefix counts as used.
      if (m[2]) for (const k of Object.keys(EN)) if (k.startsWith(`${lit}.`)) used.add(k)
    }
    for (const m of src.matchAll(/\bt\('(\w+)'/g)) for (const ns of namespaces) if (EN[`${ns}.${m[1]}`]) used.add(`${ns}.${m[1]}`)
  }
  it('finds the dashboard keys', () => {
    expect(used.size).toBeGreaterThan(400)
  })
  it('each has an es entry (or is listed in pending-sable.json)', () => {
    expect([...used].filter((k) => !ES[k] && !pendingKeys.has(k)).sort()).toEqual([])
  })
  it('no pending key is rendered by the dashboard except the not-shown tip perks', () => {
    expect([...used].filter((k) => pendingKeys.has(k)).sort()).toEqual(['tips.nudgePerk.doneForYouEdits', 'tips.nudgePerk.quarterlyCall'])
  })
})

describe('Spanish dates: every space is U+00A0', () => {
  const d = new Date('2026-10-09T17:00:00Z')
  it('formatDateIn / formatBillingDate / formatPlanEndDate', () => {
    expect(formatDateIn('es', d, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })).toBe('9\u00A0de\u00A0octubre\u00A0de\u00A02026')
    // The short billing date: no plain space either.
    expect(formatBillingDate(d, '—', 'es')).toBe('9\u00A0oct\u00A02026')
    expect(formatPlanEndDate(d, 'es')).toBe('9\u00A0de\u00A0octubre\u00A0de\u00A02026')
  })
  it('English dates keep the ladder-fix no-break spaces', () => {
    expect(formatPlanEndDate(d, 'en')).toBe('October\u00A09,\u00A02026')
  })
})
