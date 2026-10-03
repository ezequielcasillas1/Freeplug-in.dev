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
