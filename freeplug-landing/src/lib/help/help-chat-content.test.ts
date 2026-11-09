import { BUYOUT_FAQ_ANSWER } from '@/lib/buyout/buyout'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HELP_QUICK_QUESTIONS, PENDING_LADDER_COPY_REF } from './help-chat-content'
import { HELP_HIDDEN_FEES, HELP_PAYMENT_METHOD, HELP_REQUEST_CHANGES, HELP_WHAT_DO_I_PAY } from '@/lib/plans/ladder-copy'
import { CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE } from '@/lib/stripe/active-subscription'
import { PRIORITY_HELP_ANSWER } from '@/lib/plans/priority'

const LOCKED_FILE =
  process.env.FREEPLUG_LOCKED_COPY ??
  '/workspace/freeplug-qa/freeplug-english-source-LOCKED-2026-09-24.txt'

describe('help chat quick questions', () => {
  it('has the 7 questions from the spec plus hidden fees, buyout and Priority, in order', () => {
    expect(HELP_QUICK_QUESTIONS.map((q) => q.question)).toEqual([
      'Is it really free?',
      'What do I pay for?',
      'Are there any hidden fees?',
      'How long will my site take?',
      'How do I update my payment method?',
      'How do I cancel my plan?',
      'Can I buy my website?',
      'How do I reset my password?',
      'Can I request changes to my site?',
      'What is Priority?',
    ])
  })

  // Drift guard: runs where the locked English source exists (the box), skipped elsewhere.
  it.skipIf(!existsSync(LOCKED_FILE))('answers match the locked file word for word', () => {
    const lines = readFileSync(LOCKED_FILE, 'utf8').split('\n')
    for (const q of HELP_QUICK_QUESTIONS) {
      // Hosting ladder (Oct 3): PLACEHOLDER answers wait for Sable's new [STRICT] lines (checked below).
      if (q.pendingCopy) continue
      // Oct 19 (Cheke): buyout tiers; these two wait for Sable's re-lock (box draft).
      if (q.id === 'buy-website' || q.id === 'cancel-plan') continue
      // Latest entry wins: Sable appends revisions (e.g. the hosting-required faq:26 / faq:32).
      const line = lines.findLast((l) => l.startsWith(`${q.lockedRef}  `))
      expect(line, q.lockedRef).toBeDefined()
      // Older lines have a "(where)" part before the text, newer ones only tags: take the first
      // quoted string after two spaces.
      const locked = line!.match(/  "(.*)"$/)![1].replace(/\\"/g, '"')
      expect(q.answer, q.lockedRef).toBe(locked)
    }
  })

  it('uses the hosting-required answers (faq:26, faq:32) and the buyout answer', () => {
    const byId = Object.fromEntries(HELP_QUICK_QUESTIONS.map((q) => [q.id, q.answer]))
    expect(byId['is-it-free']).toContain('you pay for monthly hosting, which is required')
    expect(byId['what-do-i-pay']).toMatch(/^Hosting is required\./)
    expect(byId['buy-website']).toBe(BUYOUT_FAQ_ANSWER)
    expect(byId['buy-website']).toMatch(/The buyout covers your website files only\./)
    for (const q of HELP_QUICK_QUESTIONS) {
      expect(q.answer, q.id).not.toMatch(/optional hosting|billed (separately )?later/i)
    }
  })

  it('ladder placeholders are marked pending, come from ladder-copy.ts, and never advertise backups, alerts or uptime', () => {
    const pending = HELP_QUICK_QUESTIONS.filter((q) => q.pendingCopy)
    expect(pending.map((q) => q.id)).toEqual(['what-do-i-pay', 'hidden-fees', 'request-changes'])
    for (const q of pending) expect(q.lockedRef).toBe(PENDING_LADDER_COPY_REF)
    const byId = Object.fromEntries(HELP_QUICK_QUESTIONS.map((q) => [q.id, q.answer]))
    expect(byId['what-do-i-pay']).toBe(HELP_WHAT_DO_I_PAY)
    expect(byId['request-changes']).toBe(HELP_REQUEST_CHANGES)
    for (const q of HELP_QUICK_QUESTIONS) {
      expect(q.answer, q.id).not.toMatch(/backup|alert|uptime|99\.9|\$35 to \$100/i)
    }
  })

  it('hidden fees and cancel answers (Sable Sep 25 3:30 PM, [STRICT])', () => {
    const byId = Object.fromEntries(HELP_QUICK_QUESTIONS.map((q) => [q.id, q.answer]))
    // Hosting ladder (Oct 3): add-ons are retired, so "plus any add-on you choose" is dropped (PLACEHOLDER).
    expect(byId['hidden-fees']).toBe(HELP_HIDDEN_FEES)
    expect(byId['hidden-fees']).not.toMatch(/add-on/i)
    expect(byId['cancel-plan']).toBe(
      'Yes, you can cancel at any time. Choose Cancel options in your dashboard. Your website stays online until the end of your paid period. If you want to keep your website, you can buy your website files. See the buyout prices in the FAQ.'
    )
    expect(byId['is-it-free']).toBe(
      'Yes. Website development is free. 72 After designs and builds your website at no charge. After your site is live, you pay for monthly hosting, which is required. Maintenance or a buyout costs extra only if you ask for it. There are no hidden fees or surprise charges.'
    )
    for (const q of HELP_QUICK_QUESTIONS) expect(q.answer, q.id).not.toMatch(/export your data/i)
  })
})

// Drift guard for the pages the help chat copies from (Sable Sep 25 3:30 PM entries).
describe.skipIf(!existsSync(LOCKED_FILE))('help / FAQ page copy matches the locked file', () => {
  const lines = existsSync(LOCKED_FILE) ? readFileSync(LOCKED_FILE, 'utf8').split('\n') : []
  const locked = (label: string) =>
    lines.findLast((l) => l.startsWith(`${label}  `))!.match(/  "(.*)"$/)![1]
  const page = (rel: string) => readFileSync(join(__dirname, '..', '..', 'app', rel), 'utf8')
  // Spanish build: the dashboard Help page reads its copy from en.json (help.*), so the locked lines
  // are checked against the English values it renders (plus any copy left in the source).
  const enHelp = (): string => {
    const en = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'messages', 'en.json'), 'utf8'))
    const out: string[] = []
    const walk = (v: unknown) => {
      if (typeof v === 'string') out.push(v)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(en.help)
    return out.join('\n')
  }
  const helpPage = () => `${page('(dashboard)/dashboard/help/page.tsx')}\n${enHelp()}`
  const cases: [string, string][] = [
    // help/page.tsx:85 (cancel answer) changed Oct 19 for the buyout tiers: waits for Sable's re-lock.
  ]
  for (const [label, rel] of cases) {
    it(label, () => {
      expect(rel.endsWith('help/page.tsx') ? helpPage() : page(rel)).toContain(locked(label))
    })
  }
  // Spanish build (card C1): the public FAQ page moved to [locale]/faq and reads its copy from
  // messages/en.json (the English lock); the locked line must be the value of the key it renders.
  it('faq/page.tsx:26 (now en.json public.faq.answer.yesWebsiteDevelopmentFree)', () => {
    const en = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'messages', 'en.json'), 'utf8'))
    expect(en.public.faq.answer.yesWebsiteDevelopmentFree).toBe(locked('faq/page.tsx:26'))
    expect(page('[locale]/faq/page.tsx')).toContain("'public.faq.answer.yesWebsiteDevelopmentFree'")
  })
  // Hosting ladder (Oct 3): help/page.tsx:91 is a PLACEHOLDER until Sable re-locks it; the page and
  // the chat share one constant, so they cannot drift from each other.
  // Round 5b: Sable re-locked help/page.tsx:79 with the Manage-billing sentence (Oct 3, 3:15 PM CT).
  it('help chat "How do I update my payment method?" and help/page.tsx share HELP_PAYMENT_METHOD = the locked answer', () => {
    const q = HELP_QUICK_QUESTIONS.find((x) => x.id === 'payment-method')
    expect(q?.answer).toBe(HELP_PAYMENT_METHOD)
    expect(q?.lockedRef).toBe('src/app/(dashboard)/dashboard/help/page.tsx:79')
    expect(q?.pendingCopy).toBeUndefined()
    expect(page('(dashboard)/dashboard/help/page.tsx')).toContain('answer: HELP_PAYMENT_METHOD')
    expect(HELP_PAYMENT_METHOD).toBe(locked('src/app/(dashboard)/dashboard/help/page.tsx:79'))
    expect(HELP_PAYMENT_METHOD).toMatch(/If you have a plan switch planned, Manage billing opens Billing on your Plans page instead, where you can update your card and see your invoices\.$/)
  })

  // Round 5 (Sable flag 4): while a switch is planned, Manage billing has no cancel option, so both
  // close-request cancel instructions point to the dashboard's Cancel options link instead.
  it('cancel instructions say "choose Cancel options in your dashboard", not Manage billing', () => {
    const line = 'To cancel your plan, choose Cancel options in your dashboard.'
    const help = helpPage()
    expect(help).toContain(line)
    expect(help).not.toMatch(/To cancel, open Manage billing/)
    const active = readFileSync(join(__dirname, '..', 'stripe', 'active-subscription.ts'), 'utf8')
    expect(active).toContain(line)
    expect(active).not.toMatch(/To cancel your plan, go to Manage billing/)
  })

  // Round 5b: Sable's re-locks (Oct 3, 3:15 PM CT), pinned word for word.
  it('CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE is the locked active-subscription.ts:6 line', () => {
    expect(CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE).toBe(locked('src/lib/stripe/active-subscription.ts:6'))
  })
  it('help b-5 (close a request) is the locked help/page.tsx:97 answer', () => {
    const help = helpPage().replace(/\\'/g, "'")
    expect(help).toContain(locked('src/app/(dashboard)/dashboard/help/page.tsx:97'))
  })
  it('the Priority help answer is the locked "help page (plans answer)" line, and no "front of our queue" anywhere', () => {
    expect(PRIORITY_HELP_ANSWER).toBe(locked('help page (plans answer)'))
    expect(PRIORITY_HELP_ANSWER).not.toMatch(/front of our queue/i)
  })

  it('help chat "Are there any hidden fees?" and help/page.tsx share HELP_HIDDEN_FEES', () => {
    const q = HELP_QUICK_QUESTIONS.find((x) => x.question === 'Are there any hidden fees?')
    expect(q?.answer).toBe(HELP_HIDDEN_FEES)
    expect(page('(dashboard)/dashboard/help/page.tsx')).toContain('answer: HELP_HIDDEN_FEES')
  })
})
