import { describe, expect, it } from 'vitest'
import { NBSP, formatAmount, formatAmountCents, keepDateTogether, keepTogether } from './keep-together'
import { addonTodayTotal, planTotalLine } from '@/lib/plans/ladder-copy'
import { tipTotalText } from '@/components/plans/TipSlider'

// Any character a browser may break a line at inside a value: ordinary/ideographic spaces, tabs, newlines,
// and the narrow no-break / thin spaces some locales emit that are not U+00A0.
const BREAKABLE = /[ \t\n\r\u2000-\u200b\u3000]/

describe('Lina (Oct 13): amounts and dates are kept whole (U+00A0) in the formatting helpers', () => {
  it('formatted amounts contain no breakable spaces', () => {
    for (const v of [formatAmount(1500), formatAmount(123456), formatAmountCents(0), formatAmountCents(123456)]) expect(v).not.toMatch(BREAKABLE)
    expect(formatAmountCents(1500)).toBe('$15.00')
    expect(formatAmount(123456)).toBe('$1234.56')
  })
  it('locale-formatted amounts and dates (en and es) become one unbreakable unit', () => {
    const values = [
      new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(1234.56), // "1234,56 US$"
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(1234.56), // "$1,234.56"
      new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(2026, 10, 3)),
      new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(2026, 10, 3)), // "3 de noviembre de 2026"
      'November 3, 2026',
    ]
    for (const v of values) {
      const kept = keepTogether(v)
      expect(kept).not.toMatch(BREAKABLE)
      expect(kept.replace(new RegExp(NBSP, 'g'), ' ')).toBe(v.replace(/\s/g, ' '))
    }
    expect(keepDateTogether('3 de noviembre de 2026')).toBe(`3${NBSP}de${NBSP}noviembre${NBSP}de${NBSP}2026`)
  })
  it('the bar lines use them: amounts inside the copy have no breakable space', () => {
    for (const line of [planTotalLine(123456), addonTodayTotal(1500), tipTotalText({ monthlyCents: 6500 }, 5)]) {
      for (const amount of line.match(/\$[\d,.\u00a0]+/g) ?? []) expect(amount).not.toMatch(BREAKABLE)
    }
  })
  it('a long Spanish line still has ordinary spaces between words, so it wraps instead of clipping', () => {
    const line = `Plan Prioridad ${formatAmount(5500)} · Complementos ${formatAmountCents(1075)} · Propina ${formatAmount(400)} · se renueva el ${keepDateTogether('3 de noviembre de 2026')}`
    expect(line.split(' ').length).toBeGreaterThan(8) // break opportunities between words
    for (const unit of [formatAmount(5500), formatAmountCents(1075), keepDateTogether('3 de noviembre de 2026')]) expect(line).toContain(unit)
    expect(line).not.toMatch(/…/)
  })
})
