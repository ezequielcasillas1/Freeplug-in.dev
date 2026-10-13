import { describe, expect, it } from 'vitest'
import { NICHES } from '@/lib/envato/niche-tags'
import { COPY, TYPE_LABELS, orderedTypes, t } from './copy'

describe('picker copy', () => {
  it('EN and ES have the same keys and no empty strings', () => {
    expect(Object.keys(COPY.es).sort()).toEqual(Object.keys(COPY.en).sort())
    for (const l of ['en', 'es'] as const) for (const v of Object.values(COPY[l])) expect(v.trim()).not.toBe('')
  })
  it('type labels cover the 20 niches in both languages', () => {
    for (const l of ['en', 'es'] as const) expect(Object.keys(TYPE_LABELS[l]).sort()).toEqual([...NICHES].sort())
  })
  it('orders Cleaning first, other_local last, rest alphabetical per language', () => {
    for (const l of ['en', 'es'] as const) {
      const o = orderedTypes(l)
      expect(o).toHaveLength(20)
      expect(o[0]).toBe('cleaning')
      expect(o[19]).toBe('other_local')
      const mid = o.slice(1, 19).map((n) => TYPE_LABELS[l][n])
      expect(mid).toEqual([...mid].sort(new Intl.Collator(l === 'es' ? 'es-US' : 'en-US').compare))
    }
  })
  it('fills placeholders', () => {
    expect(t('es', 'picker.confirm.title', { name: 'Sparkle' })).toBe('¿Usar Sparkle para tu sitio?')
  })

  it('M2: Spanish flag accepts true or on', async () => {
    const { esEnabled } = await import('./copy')
    expect(esEnabled('true')).toBe(true)
    expect(esEnabled('on')).toBe(true)
    expect(esEnabled(' ON ')).toBe(true)
    expect(esEnabled('false')).toBe(false)
    expect(esEnabled(undefined)).toBe(false)
  })
  it("has Sable's fix-round keys verbatim", async () => {
    const { COPY } = await import('./copy')
    expect(COPY.en['picker.confirm.title.link']).toBe('Use the template from your link?')
    expect(COPY.es['picker.confirm.title.teampick']).toBe('¿Dejar que 72 After elija tu plantilla?')
    expect(COPY.es['picker.card.general.aria']).toBe('Plantilla general, no hecha para un solo tipo de negocio')
    expect(COPY.en['picker.showmore.aria.rest']).toBe('Show more templates')
  })
})
