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
    // Exempt: exactly Sable's final add-on strings (Oct 4 9:05 AM CT) that must say refund / account credit
    // (Aria 8:59: the real amount after credit, and the self-heal's automatic refund). Same sample args as walk().
    const sample = (f: (...a: unknown[]) => unknown) => {
      try {
        return String(f('Priority', 'November 3, 2026'))
      } catch {
        return null
      }
    }
    const exempt = new Set<string | null>([
      copy.ADDON_CREDIT_COVERS,
      sample(copy.addonChargeAfterCreditLine as (...a: unknown[]) => unknown),
      sample(copy.addonFinishing as (...a: unknown[]) => unknown),
      sample(copy.addonRefunded as (...a: unknown[]) => unknown),
      sample(copy.addonRefundFailed as (...a: unknown[]) => unknown),
    ])
    expect(exempt.size).toBe(5)
    for (const s of all) if (!exempt.has(s)) expect(s).not.toMatch(/refund|guarantee|money[- ]back|\bcredit(ed)?\b|we promise/i)
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

describe("Sable's final add-on strings, Oct 4 9:05 AM CT, word for word", () => {
  const n = '+1 small edit'
  const d = 'November 3, 2026'
  it('turn on (live plan): question, loading, charge lines, then line, preview failed, tip drop', () => {
    expect(copy.addonTurnOnQuestion(n)).toBe('Turn on +1 small edit?')
    expect(copy.UPGRADE_CALCULATING).toBe('Checking the amount…')
    expect(copy.addonChargeNowLine(575)).toBe("We'll charge $5.75 today for this billing period.")
    expect(copy.addonChargeAfterCreditLine(375)).toBe("We'll charge $3.75 today, after your account credit.")
    expect(copy.ADDON_CREDIT_COVERS).toBe('Nothing is charged today. Your account credit covers it.')
    expect(copy.addonThenLine(6075, d)).toBe('Then $60.75/month starting November 3, 2026.')
    expect(copy.addonThenLine(6075, null)).toBe('Then $60.75/month.')
    expect(copy.addonChargeUpToLine(575)).toBe("We'll charge up to $5.75 today for this billing period.")
    expect(copy.addonTipGoesDownQuestion(14, d, n)).toBe('Your tip goes down to $14 starting November 3, 2026. Turn on +1 small edit?')
  })
  it('turn off and keep', () => {
    expect(copy.addonOffQuestion('Big change', d)).toBe('Turn off Big change? It stays on until November 3, 2026, then it ends.')
    expect(copy.addonEndsLine(d)).toBe('Ends November 3, 2026')
    expect(copy.ADDON_KEEP).toBe('Keep it')
    expect(copy.addonOnDone(n)).toBe('+1 small edit is on.')
    expect(copy.addonOffDone('Big change', d)).toBe('Big change ends November 3, 2026.')
    expect(copy.addonKeepDone('Big change')).toBe('Big change stays on.')
  })
  it('locks', () => {
    expect(copy.addonsLockedBySwitch(d)).toBe('You can change add-ons after your switch on November 3, 2026.')
    expect(copy.ADDONS_LOCKED_BY_REMOVAL).toBe('An add-on is set to end. Choose Keep it, or wait until it ends to make other changes.')
    expect(copy.ADDON_PENDING_REMOVAL).toBe(copy.ADDONS_LOCKED_BY_REMOVAL)
    expect(copy.ADDONS_LEGACY_NOTE).toBe("Add-ons aren't available on your plan. To use them, switch to one of the plans above.")
  })
  it('errors', () => {
    expect(copy.ADDON_ERROR).toBe("We couldn't change your add-ons right now. Try again, or email support@freeplug-in.dev.")
    expect(copy.addonPaymentFailed(n)).toBe("Your card wasn't charged, so +1 small edit is still off. Update your card in Manage billing, then try again.")
    expect(copy.addonFinishing(n)).toBe(
      "Your payment went through. We're finishing turning on +1 small edit. Refresh in a moment to see it. If it can't be added, we'll refund the charge automatically."
    )
    expect(copy.addonRefunded(n)).toBe("We couldn't turn on +1 small edit, so we've refunded the charge to your card. It can take 5–10 business days to show.")
    expect(copy.addonRefundFailed(n)).toBe(
      "We couldn't turn on +1 small edit, and the refund didn't go through automatically. Email support@freeplug-in.dev and we'll sort out the charge."
    )
  })
  it('help chat link label', () => {
    expect(copy.GO_TO_PLANS).toBe('Go to Plans')
  })
  it('names and prices come from ADDON_NAMES / ADDONS', () => {
    expect(copy.ADDON_NAMES.small_edit).toBe('+1 small edit')
    expect(copy.ADDON_NAMES.big_change).toBe('Big change')
  })
})
