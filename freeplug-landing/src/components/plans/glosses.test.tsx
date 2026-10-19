/** Aria ruling 2 / Sable §3: English names on cards, one-line Spanish gloss under them (es only). */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTestLocale } from '../../../test/intl-mock'

vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({ openBillingPortal: vi.fn() }))

import { HostingCheckoutCard } from './HostingCheckoutCard'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { ladderCopy } from '@/lib/plans/ladder-copy'

beforeEach(() => vi.stubEnv('FREEPLUG_I18N_ES_ALLOW_PENDING', '1'))
afterEach(() => {
  setTestLocale('en')
  vi.unstubAllEnvs()
})

describe('plan and add-on glosses', () => {
  it('English: no glosses at all', () => {
    const en = ladderCopy('en')
    expect(Object.values(en.PLAN_GLOSS).every((v) => v === null)).toBe(true)
    expect(Object.values(en.ADDON_GLOSS).every((v) => v === null)).toBe(true)
    render(<HostingCheckoutCard />)
    expect(screen.queryAllByTestId('plan-gloss')).toHaveLength(0)
  })

  it('Spanish: Sable\'s glosses, names stay English', () => {
    const es = ladderCopy('es')
    expect(es.PLAN_GLOSS.starter).toBe('Tu sitio web en línea, con conexión segura https')
    expect(es.PLAN_GLOSS.growth).toBe('Actualización de temporada y llamada trimestral')
    expect(es.ADDON_GLOSS.small_edit).toBe('Un cambio pequeño extra al mes')
    expect(es.ADDON_NAMES.small_edit).toBe('+1 small edit')
    expect(es.ADDON_NAMES.big_change).toBe(ladderCopy('en').ADDON_NAMES.big_change)
    setTestLocale('es')
    render(<HostingCheckoutCard />)
    expect(screen.getAllByTestId('plan-gloss')).toHaveLength(PLAN_STEPS.length)
    for (const s of PLAN_STEPS) expect(screen.getAllByText(s.name).length).toBeGreaterThan(0)
  })
})
