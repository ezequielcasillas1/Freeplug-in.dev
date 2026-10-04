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
    // Exempt: exactly Sable's add-on strings that must say refund / account credit (Sable Oct 4 9:05 and
    // 9:29 AM CT: the card note, the real amount after credit, the self-heal refund and its split). Same
    // sample args as walk(). Nothing else may match, and every exempt string must still need it.
    const sample = (f: (...a: unknown[]) => unknown) => {
      try {
        return String(f('Priority', 'November 3, 2026'))
      } catch {
        return null
      }
    }
    const fn = (f: unknown) => sample(f as (...a: unknown[]) => unknown)
    const exempt = new Set<string | null>([
      fn(copy.addonChargeNote),
      fn(copy.addonChargeAfterCreditLine),
      copy.ADDON_CREDIT_COVERS,
      fn(copy.addonFinishing),
      fn(copy.addonRefundSplitLine),
      fn(copy.addonRefunded),
      fn(copy.addonRefundNote),
      fn(copy.addonRefundFailed),
      // L-1 (Sable 10:01): the self-heal refund email subject says "refunded" (the 9th; forced by this line)
      fn(copy.addonTurnedOffRefundEmailSubject),
      // Aria 10:09 (option A): the resume status promises a refund if the owed add-on is charged (the 10th)
      fn(copy.RESUME_REMOVAL_OWED_STATUS),
    ])
    expect(exempt.size).toBe(10)
    const banned = /refund|guarantee|money[- ]back|\bcredit(ed)?\b|we promise/i
    expect(new Set(all.filter((s) => banned.test(s)))).toEqual(exempt)
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
    expect(copy.addonRefunded(n, 500, 0)).toBe("We couldn't turn on +1 small edit. We refunded $5 to your card. The card refund can take 5–10 business days to show up.")
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

describe("Sable, Oct 4 9:29 AM CT: the five lines, word for word", () => {
  const n = '+1 small edit'
  it('1. no-date tip line (the plan switch date is unknown)', () => {
    expect(copy.addonTipGoesDownQuestion(13, null, n)).toBe('Your tip goes down to $13 starting with your next bill. Turn on +1 small edit?')
  })
  it('2. no-date lock line, as written', () => {
    expect(copy.addonsLockedBySwitch(null)).toBe('You can change add-ons after your plan switch.')
  })
  it('3. checkout tip line, same verb', () => {
    expect(copy.addonTipDropQuestion(8, 'Big change')).toBe('Your tip goes down to $8. Turn on Big change?')
  })
  it('4. card note (the confirm screen still shows the exact amount)', () => {
    expect(copy.addonChargeNote(500)).toBe(
      'Turning it on charges $5 today for this billing period, then $5 each month. Any account credit is used first. If you turn it off, it stays on until the period ends.'
    )
    expect(copy.addonChargeNote(575)).toBe(
      'Turning it on charges $5.75 today for this billing period, then $5.75 each month. Any account credit is used first. If you turn it off, it stays on until the period ends.'
    )
  })
  it('5. the refund line, split by where the money went', () => {
    expect(copy.addonRefundSplitLine(575, 0)).toBe('We refunded $5.75 to your card.')
    expect(copy.addonRefundSplitLine(0, 575)).toBe('We added $5.75 back to your account credit.')
    expect(copy.addonRefundSplitLine(35, 540)).toBe('We refunded $0.35 to your card and added $5.40 back to your account credit.')
    // composed on Confirm (new composition, for Sable): the 5–10 days only when a card got money back
    expect(copy.addonRefunded('Big change', 0, 575)).toBe("We couldn't turn on Big change. We added $5.75 back to your account credit.")
    expect(copy.addonRefunded('Big change', 35, 540)).toBe(
      "We couldn't turn on Big change. We refunded $0.35 to your card and added $5.40 back to your account credit. The card refund can take 5–10 business days to show up."
    )
  })
})

describe('Aria 9:27 / 9:28: new strings (listed for Sable), word for word', () => {
  it('small charge under $0.50: the confirm line', () => {
    expect(copy.addonAddedToNextBill(35)).toBe('$0.35 will be added to your next bill.')
    expect(copy.addonAddedToNextBill(5)).toBe('$0.05 will be added to your next bill.')
  })
  it('discount or tax: the refusal', () => {
    expect(copy.ADDON_PRICE_UNCONFIRMED).toBe("We couldn't confirm this price. Please try again, or email support@freeplug-in.dev and we'll help.")
  })
  it('refund reasons (dashboard note + email), each followed by the split line', () => {
    const r = (reason: copy.AddonRefundReason) => copy.addonRefundNote('Big change', reason, 575, 0)
    const tail = ' We refunded $5.75 to your card. The card refund can take 5–10 business days to show up.'
    expect(r('switch_pending')).toBe("We couldn't turn on Big change because a plan switch was already scheduled. Add-ons can't change until the switch happens." + tail)
    expect(r('removal_pending')).toBe("We couldn't turn on Big change because another add-on was already set to end. Add-ons can't change until it ends." + tail)
    expect(r('period_ended')).toBe("We couldn't turn on Big change because the billing period you paid for ended before we could add it." + tail)
    expect(r('tip_unconfirmed')).toBe("We couldn't turn on Big change because it would have lowered your tip, which you hadn't confirmed." + tail)
    expect(r('plan_ended')).toBe("We couldn't turn on Big change because your hosting plan has ended or is set to end." + tail)
    expect(r('not_added')).toBe("We couldn't turn on Big change because of a problem adding it to your plan." + tail)
    expect(copy.addonRefundNote('Big change', 'period_ended', 0, 575)).toBe(
      "We couldn't turn on Big change because the billing period you paid for ended before we could add it. We added $5.75 back to your account credit."
    )
    expect(r('turned_off')).toBe('You turned off Big change, but it was still on your latest bill.' + tail)
    expect(Object.keys(copy.ADDON_REFUND_REASONS).sort()).toEqual(['not_added', 'period_ended', 'plan_ended', 'removal_pending', 'switch_pending', 'tip_unconfirmed', 'turned_off'])
    expect(copy.isAddonRefundReason('period_ended')).toBe(true)
    expect(copy.isAddonRefundReason('nope')).toBe(false)
  })
  it('refund email: subject and help line', () => {
    expect(copy.addonRefundEmailSubject('Big change')).toBe("We couldn't turn on Big change")
    // L-1 self-heal refund email ONLY (Sable 10:01)
    expect(copy.addonTurnedOffRefundEmailSubject('Big change')).toBe('We refunded your Big change charge.')
    // Aria 10:09 (option A): the resume status, word for word
    expect(copy.RESUME_REMOVAL_OWED_STATUS('Big change')).toBe("Your plan is back on. We're still turning off Big change. If it's charged before that's done, we'll refund it.")
    expect(copy.addonTurnedOffRefundEmailSubject('+1 small edit')).toBe('We refunded your +1 small edit charge.')
    expect(copy.addonNameList(['small_edit', 'big_change'])).toBe('+1 small edit and Big change')
    expect(copy.ADDON_REFUND_EMAIL_HELP).toBe('Questions? Email support@freeplug-in.dev.')
  })
})
