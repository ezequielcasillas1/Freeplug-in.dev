import { describe, expect, it } from 'vitest'
import * as copy from './ladder-copy'
import * as help from '@/lib/help/help-chat-content'

/** Every string export (functions are called with sample arguments). */
function strings(mod: Record<string, unknown>): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (typeof v === 'function') {
      try {
        walk((v as (...a: unknown[]) => unknown)('Priority', 'November 3, 2026'))
      } catch {
        /* not a copy function */
      }
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  Object.values(mod).forEach(walk)
  return out
}

describe('ladder copy: next-business-day is a target (Aria, Oct 3 12:25)', () => {
  it('uses the approved placeholder wording', () => {
    expect(copy.NEXT_BUSINESS_DAY_TARGET).toBe('by end of next business day (Mon–Fri, excluding holidays)')
    expect(copy.PERK_LINES.nextBusinessDayEdits).toContain(copy.NEXT_BUSINESS_DAY_TARGET)
    expect(copy.NEXT_BUSINESS_DAY_LINE).toContain(copy.NEXT_BUSINESS_DAY_TARGET)
  })

  it('no refund, credit or guarantee wording anywhere in ladder copy or the help chat', () => {
    const all = [...strings(copy), ...strings(help as unknown as Record<string, unknown>)]
    expect(all.length).toBeGreaterThan(20)
    for (const s of all) expect(s).not.toMatch(/refund|guarantee|money[- ]back|\bcredit(ed)?\b|we promise/i)
  })
})

describe("Sable's final wording, 4:32 PM CT (billing fix batch 68d7e2b), word for word", () => {
  it('resume / cancel failures carry the support contact from src/lib/site.ts', () => {
    expect(copy.RESUME_FAILED_MESSAGE).toBe(
      "We couldn't resume your plan, so it's still set to end. Please try again in a moment, or contact us at support@freeplug-in.dev or 737-392-5612 and we'll help."
    )
    expect(copy.CANCEL_FAILED_MESSAGE).toBe(
      "We couldn't cancel your plan just now, so nothing has changed. Please try again in a moment, or contact us at support@freeplug-in.dev or 737-392-5612."
    )
  })
  it('invoice parts read "Plan $55.00 · Optional tip $4.00"', () => {
    expect(`${copy.INVOICE_PLAN_PART('$55.00')} · ${copy.INVOICE_TIP_PART('$4.00')}`).toBe('Plan $55.00 · Optional tip $4.00')
  })
  it('locked tip row "$4 monthly tip"; the locked note keeps its 3:19 PM wording (unchanged at 4:32)', () => {
    expect(copy.TIP_LOCKED_AMOUNT('$4')).toBe('$4 monthly tip')
    expect(copy.TIP_LOCKED_NOTE('November 3, 2026')).toBe(
      'Your tip ends on November 3, 2026, when your planned switch starts. You can choose a new tip after that.'
    )
  })
  it('plan set to end: the plan switch and the tip box each get their own line', () => {
    expect(copy.CHANGE_PLAN_ENDING).toBe('Your plan is set to end. Choose Resume plan first, then switch.')
    expect(copy.TIP_CHANGE_ENDING).toBe("Your plan is set to end, so your tip can't be changed. Choose Resume plan first.")
    expect(copy.TIP_CHANGE_ENDING).not.toMatch(/switch/)
  })
})
