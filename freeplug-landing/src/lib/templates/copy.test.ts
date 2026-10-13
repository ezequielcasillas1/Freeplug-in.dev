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
})
