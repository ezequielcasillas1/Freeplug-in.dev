import { describe, expect, it } from 'vitest'
import {
  buyoutPreview,
  checklistFromFormData,
  checklistSummaryRows,
  isChecklistComplete,
  missingFields,
  parseChecklistDraft,
  type Checklist,
} from './checklist'

const COMPLETE: Checklist = {
  site_type: 'service',
  page_count: 6,
  template_choice: 'bold',
  content_source: 'some',
  photo_source: 'own',
  domain_path: 'freeplug',
  forms: ['contact', 'quote'],
  booking: 'none',
  payments: 'none',
  plan: 'starter',
  timeline: 'asap',
}

describe('consultation checklist', () => {
  it('a draft can be saved with nothing filled in, and blanks are dropped', () => {
    const r = parseChecklistDraft({ site_type: '', notes: '  ', forms: [] })
    expect(r).toEqual({ ok: true, value: {} })
  })

  it('rejects unknown options and unknown keys', () => {
    expect(parseChecklistDraft({ site_type: 'casino' }).ok).toBe(false)
    expect(parseChecklistDraft({ evil: 'x' }).ok).toBe(false)
    expect(parseChecklistDraft({ page_count: '0' }).ok).toBe(false)
    expect(parseChecklistDraft({ domain_name: 'not a domain' }).ok).toBe(false)
  })

  it('lists every required field until complete, including conditional ones', () => {
    expect(missingFields({})).toHaveLength(11)
    expect(isChecklistComplete(COMPLETE)).toBe(true)
    expect(missingFields({ ...COMPLETE, site_type: 'other' })).toEqual(['Type (other)'])
    expect(missingFields({ ...COMPLETE, domain_path: 'own' })).toEqual(['Domain name'])
    expect(missingFields({ ...COMPLETE, booking: 'link' })).toEqual(['Booking tool'])
  })

  it('shows the buyout tier live from the page count, with 20% off for an own domain', () => {
    expect(buyoutPreview(undefined, 'freeplug')).toBeNull()
    expect(buyoutPreview(5, 'freeplug')).toMatchObject({ totalCents: 50_000, discountCents: 0 })
    expect(buyoutPreview(6, 'freeplug')?.tier.id).toBe('up_to_7')
    expect(buyoutPreview(11, 'own')).toMatchObject({ baseCents: 95_000, discountCents: 19_000, totalCents: 76_000 })
    expect(buyoutPreview(16, 'own')?.line).toMatch(/\$1,600 with your own domain \(20% off\)/)
  })

  it('reads the same shape from a form post (multi-select forms)', () => {
    const fd = new FormData()
    fd.set('site_type', 'retail')
    fd.append('forms', 'contact')
    fd.append('forms', 'newsletter')
    fd.set('page_count', '3')
    const parsed = parseChecklistDraft(checklistFromFormData(fd))
    expect(parsed).toEqual({ ok: true, value: { site_type: 'retail', forms: ['contact', 'newsletter'], page_count: 3 } })
  })

  it('summary rows use labels, not ids', () => {
    const rows = checklistSummaryRows(COMPLETE)
    expect(rows.find((r) => r.label === 'Type of website')?.value).toMatch(/Service business/)
    expect(rows.find((r) => r.label === 'Forms')?.value).toBe('Contact form, Quote request')
    expect(rows.find((r) => r.label === 'Hosting plan')?.value).toBe('Starter')
  })
})

describe('buyoutPreview page edges (Oct 30, 7:18 PM CT)', () => {
  it('20 pages is $2,000; 21 and 35 are Custom enterprise (quoted); 36+ has no tier yet and returns null without throwing', () => {
    expect(buyoutPreview(20, 'freeplug')?.baseCents).toBe(200000)
    for (const n of [21, 35]) {
      const p = buyoutPreview(n, 'own')!
      expect(p.tier.id).toBe('custom')
      expect(p.baseCents).toBeNull()
      expect(p.line).toMatch(/quote it for you.*20% own-domain discount applies too/)
    }
    expect(buyoutPreview(36, 'own')).toBeNull()
    expect(buyoutPreview(200, 'freeplug')).toBeNull()
  })
})
