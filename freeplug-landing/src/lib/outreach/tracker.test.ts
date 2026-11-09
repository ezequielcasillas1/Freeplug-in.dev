import { describe, expect, it } from 'vitest'
import { CONSULTATION_STEP_HREF, isConsultationDone, organicTracker } from './tracker'

const base = { hasRequest: true, consultationDone: false, building: false, hostingSetUp: false, live: false }

describe('organicTracker consultation step (Oct 23)', () => {
  it('EN: Consultation sits between Request sent and Building', () => {
    expect(organicTracker(base).map((s) => s.label)).toEqual(['Request sent', 'Consultation', 'Building', 'Your review', 'Hosting set up', 'Live'])
  })
  it('ES: Consulta', () => {
    expect(organicTracker(base, 'es')[1].label).toBe('Consulta')
  })
  it('current + linked to the choice page when the request is sent and consultation not done', () => {
    const s = organicTracker(base)
    expect(s[0].state).toBe('done')
    expect(s[1]).toMatchObject({ state: 'current', href: CONSULTATION_STEP_HREF })
    expect(s[2].state).toBe('todo')
  })
  it('done (no link) once the form is sent or a session is booked; Building becomes current', () => {
    const s = organicTracker({ ...base, consultationDone: true })
    expect(s[1].state).toBe('done')
    expect(s[1].href).toBeUndefined()
    expect(s[2].state).toBe('current')
  })
  it('building or hosting implies consultation done', () => {
    expect(organicTracker({ ...base, building: true })[1].state).toBe('done')
    expect(organicTracker({ ...base, hostingSetUp: true })[1].state).toBe('done')
  })
})

describe('isConsultationDone', () => {
  it.each([
    ['choose', 'submitted', false],
    [null, 'submitted', false],
    ['form_draft', 'consultation', false],
    ['live_booking', 'consultation', false],
    ['live_waiting', 'consultation', true],
    ['review', 'consultation', true],
    ['agreed', 'agreed', true],
    [null, 'building', true],
  ] as const)('%s / %s -> %s', (stage, status, want) => {
    expect(isConsultationDone(stage, status)).toBe(want)
  })
})
