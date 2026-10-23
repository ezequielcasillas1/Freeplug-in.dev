// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dunningView } from './dunning'
import { dunningAlert } from './dunning-copy'

const c = { first_failed_at: '2026-11-01T15:00:00Z', domain_expires_at: null }
const day = (d: number) => new Date(Date.parse(c.first_failed_at) + d * 86_400_000 + 3_600_000)

describe('dunning notices (EN/ES)', () => {
  it('grace: gentle, not "past due"', () => {
    const a = dunningAlert(dunningView(c, day(2)), 'en')!
    expect(a).toMatchObject({ id: 'dunning-grace', type: 'info', actionLabel: 'Pay now', actionHref: '/dashboard/plans' })
    expect(a.message.replace(/\u00a0/g, ' ')).toContain('November 15, 2026')
    expect(`${a.title} ${a.message}`).not.toMatch(/past due/i)
    expect(dunningAlert(dunningView(c, day(2)), 'es')!.actionLabel).toBe('Pagar ahora')
  })
  it('past due on day 14, names the pause date (day 17)', () => {
    const a = dunningAlert(dunningView(c, day(14)), 'en')!
    expect(a).toMatchObject({ id: 'dunning-past-due', type: 'warning' })
    expect(a.message.replace(/\u00a0/g, ' ')).toContain('November 18, 2026')
    expect(a.message).toContain("won't be deleted")
  })
  it('paused on day 17: saved, not deleted', () => {
    expect(dunningAlert(dunningView(c, day(17)), 'en')!.message).toMatch(/saved, not deleted/)
    expect(dunningAlert(dunningView(c, day(17)), 'es')!.message).toMatch(/guardado, no borrado/)
  })
  it('no case = no notice', () => expect(dunningAlert(null)).toBeNull())
})
