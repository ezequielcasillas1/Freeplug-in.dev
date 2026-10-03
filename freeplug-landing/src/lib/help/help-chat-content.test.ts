import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HELP_QUICK_QUESTIONS } from './help-chat-content'

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
    expect(byId['buy-website']).toBe(
      "Yes. You can buy your website for a one-time fee. The price is based on an estimate of your website's value, and you'll see the exact price before you pay. The fee covers your finished website. Moving your domain is handled separately."
    )
    for (const q of HELP_QUICK_QUESTIONS) {
      expect(q.answer, q.id).not.toMatch(/optional hosting|billed (separately )?later/i)
    }
  })

  it('hidden fees and cancel answers (Sable Sep 25 3:30 PM, [STRICT])', () => {
    const byId = Object.fromEntries(HELP_QUICK_QUESTIONS.map((q) => [q.id, q.answer]))
    expect(byId['hidden-fees']).toBe(
      "No. You pay for monthly hosting, which is required, plus any add-on you choose. One-time maintenance or a buyout costs extra only if you request it. Building your website is free, and you'll see the price before you pay."
    )
    expect(byId['cancel-plan']).toBe(
      'Yes, you can cancel at any time. Choose Cancel options in your dashboard. Your website stays online until the end of your paid period. If you want to keep your website, you can request a buyout quote.'
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
  const cases: [string, string][] = [
    ['help/page.tsx:85', '(dashboard)/dashboard/help/page.tsx'],
    ['help/page.tsx:91', '(dashboard)/dashboard/help/page.tsx'],
    ['faq/page.tsx:26', 'faq/page.tsx'],
  ]
  for (const [label, rel] of cases) {
    it(label, () => {
      expect(page(rel)).toContain(locked(label))
    })
  }
  it('help chat "Are there any hidden fees?" is help/page.tsx:91 word for word', () => {
    const q = HELP_QUICK_QUESTIONS.find((x) => x.question === 'Are there any hidden fees?')
    expect(q?.answer).toBe(locked('help/page.tsx:91'))
  })
})
