import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { consultationCopy } from './i18n'

describe('consultation chooser copy (QA M2/L1)', () => {
  it('option labels and back link are translated', () => {
    const es = consultationCopy('es')
    expect([es.OPTION_A_LABEL, es.OPTION_B_LABEL, es.BACK_TO_DASHBOARD]).toEqual(['Opción A', 'Opción B', '← Volver al panel'])
    expect(consultationCopy('en').OPTION_A_LABEL).toBe('Option A')
  })
  it('live intro offers 15 or 30 minutes', () => {
    expect(consultationCopy('en').LIVE_PAGE_INTRO).toContain('15 or 30 minutes (your pick)')
    expect(consultationCopy('es').LIVE_PAGE_INTRO).toContain('15 o 30 minutos (tú eliges)')
  })
  it('no hard-coded English option/back labels left in consultation screens', () => {
    const base = 'src/app/(dashboard)/dashboard/consultation/'
    for (const f of ['ConsultationChooser.tsx', 'details/page.tsx', 'summary/page.tsx']) {
      const src = readFileSync(base + f, 'utf8')
      expect(src).not.toMatch(/>Option [AB]<|← Back to dashboard/)
    }
  })
})
