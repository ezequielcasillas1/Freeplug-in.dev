/**
 * Aria, Oct 3 12:56: no AI-edit counts in customer copy until the AI editor ships. The numbers stay in
 * ladder.ts (PLAN_STEPS[].aiEditsPerMonth) behind showAiEditQuota = false. This test fails if any
 * customer-facing output shows an edit count while the flag is false:
 *   1. every ladder-copy export (strings, lists, records, and functions called with sample values),
 *      the help-chat content and the email templates, swept as values;
 *   2. the plan cards (Plans page, landing pricing, claim step 3 all render HostingCheckoutCard or
 *      the ladder copy) rendered for every step and both pricing views;
 *   3. a source scan of every customer-facing folder: no raw `aiEditsPerMonth` read (use
 *      customerAiEditsPerMonth()/aiEditsLine(), which honour the flag) and no literal edit-count text.
 * The included small edit ("one small edit each billing period", Fast lane) is a human-made edit,
 * not an AI-edit count, and is allowed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PLAN_STEPS, customerAiEditsPerMonth, showAiEditQuota } from './ladder'
import * as copy from './ladder-copy'
import * as helpChat from '@/lib/help/help-chat-content'

vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({ openBillingPortal: async () => undefined }))

/** Edit-count wording: "AI edits", "15 edits a month", "edits: 5", "5 AI edits per month"... */
const EDIT_COUNT = [
  /\bAI[\s-]*edits?\b/i,
  // Oct 18: plan edit counts ("2 edits a month") are shown on purpose now; only AI-edit counts stay hidden.
  /\b\d+\s+AI\s+(?:quick\s+|small\s+)?edits?\s*(?:a|per|each|\/)\s*(?:month|mo)\b/i,
  /\bedits?\s*(?:per month|a month|\/\s*mo(?:nth)?)\s*:\s*\d+/i,
]
const showsEditCount = (text: string) => EDIT_COUNT.some((re) => re.test(text))

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 6 || value == null) return
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'function') {
    for (const args of [['Starter', 'Nov 3, 2026'], [0, 1], [1, 1], [PLAN_STEPS[2]], [PLAN_STEPS[0], false]]) {
      try {
        collectStrings((value as (...a: unknown[]) => unknown)(...args), out, depth + 1)
      } catch {
        /* not callable with these samples */
      }
    }
  } else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out, depth + 1))
  else if (typeof value === 'object') Object.values(value as object).forEach((v) => collectStrings(v, out, depth + 1))
}

describe('AI-edit counts stay hidden while showAiEditQuota is false', () => {
  it('the flag is false and the numbers are still kept in ladder.ts', () => {
    expect(showAiEditQuota).toBe(false)
    expect(PLAN_STEPS.map((s) => s.aiEditsPerMonth)).toEqual([5, 15, 15, 40, 40, 40])
    for (const s of PLAN_STEPS) {
      expect(customerAiEditsPerMonth(s)).toBeNull()
      expect(copy.aiEditsLine(s)).toBeNull()
    }
  })

  it('Starter, Priority and Fast lane stay sellable on their other perks', () => {
    expect(PLAN_STEPS.filter((s) => s.sellable).map((s) => s.id)).toEqual(['starter', 'priority', 'fast_lane'])
  })

  it('the detector catches the wording that would ship with the flag on (sanity check)', () => {
    expect(showsEditCount(copy.aiEditsLine(PLAN_STEPS[1], true)!)).toBe(true)
    expect(showsEditCount('15 AI edits a month')).toBe(true)
    expect(showsEditCount('2 edits a month: small changes')).toBe(false) // Oct 18: plan edit counts are shown on purpose
    expect(showsEditCount('Edits per month: 40')).toBe(true)
    expect(showsEditCount('One small edit by us each billing period')).toBe(false)
    expect(showsEditCount('Your included edit: 1 available this billing period.')).toBe(false)
  })

  it('no ladder copy, help-chat answer or email template shows an edit count', async () => {
    const strings: string[] = []
    collectStrings(copy, strings)
    collectStrings(helpChat, strings)
    const emailDir = path.join(process.cwd(), 'src/lib/email/templates')
    for (const f of readdirSync(emailDir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('.test.'))) {
      collectStrings(await import(path.join(emailDir, f)), strings)
    }
    expect(strings.length).toBeGreaterThan(50)
    expect(strings.filter(showsEditCount)).toEqual([])
  })

  it('the plan cards (Plans page, pricing, claim) show no edit count for any step', async () => {
    const { HostingCheckoutCard } = await import('@/components/plans/HostingCheckoutCard')
    const views = [
      {},
      { signedIn: false },
      { onChoosePlan: async () => null, chooseLabel: 'Save plan' },
      { currentPlanLines: ['Fast lane: $65/month'], currentStepId: 'fast_lane' as const, onChangePlan: async () => ({ ok: true, message: '' }), pendingChange: { stepId: 'starter' as const, date: 'Nov 3, 2026' } },
    ]
    for (const props of views) {
      const { container, unmount } = render(<HostingCheckoutCard {...props} />)
      const text = container.textContent ?? ''
      for (const s of PLAN_STEPS) expect(text).toContain(s.name)
      expect(showsEditCount(text)).toBe(false)
      unmount()
    }
  })

  it('no customer-facing source reads the raw quota or hard-codes edit-count text', () => {
    const root = process.cwd()
    const dirs = ['src/app', 'src/components', 'src/features', 'src/lib/email', 'src/lib/help', 'src/lib/outreach', 'src/lib/dashboard']
    const files: string[] = []
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const p = path.join(d, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx|md|json)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) files.push(p)
      }
    }
    dirs.forEach((d) => walk(path.join(root, d)))
    files.push(path.join(root, 'src/lib/plans/ladder-copy.ts'))
    expect(files.length).toBeGreaterThan(100)
    const offenders: string[] = []
    for (const f of files) {
      const rel = path.relative(root, f)
      if (rel.startsWith(path.join('src', 'app', 'admin'))) continue // staff-only screens
      let src = readFileSync(f, 'utf8')
      if (rel === path.join('src', 'lib', 'plans', 'ladder-copy.ts')) {
        // The one gated template: it must go through customerAiEditsPerMonth() (flag-aware), and is
        // checked by value above; everything else in the file is scanned.
        // i18n (Oct 4): the copy is built per locale in build(); the template is the aiEditsLine entry.
        const start = src.indexOf('    aiEditsLine: (')
        const end = src.indexOf('\n    },\n', start)
        expect(start).toBeGreaterThan(-1)
        expect(src.slice(start, end)).toContain('customerAiEditsPerMonth(step, show)')
        src = src.slice(0, start) + src.slice(end)
      }
      if (/\.aiEditsPerMonth\b/.test(src)) offenders.push(`${rel}: reads aiEditsPerMonth directly`)
      for (const m of src.matchAll(/(['"`])((?:(?!\1).){0,300})\1/g)) {
        if (showsEditCount(m[2])) offenders.push(`${rel}: ${m[2]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
