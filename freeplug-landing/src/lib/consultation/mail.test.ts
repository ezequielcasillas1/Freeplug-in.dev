// @vitest-environment node
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sendMail = vi.hoisted(() => vi.fn(async () => ({ success: true, id: 'x' })))
vi.mock('@/lib/email/mailer', () => ({ sendMail }))

import { consultationMailMode, loggedMail, sendConsultationMail, TEAM_INBOX } from './mail'

afterEach(() => {
  vi.unstubAllEnvs()
  sendMail.mockClear()
})

describe('consultation mail (test mode)', () => {
  it('logs and never sends by default', async () => {
    vi.stubEnv('CONSULTATION_MAIL_MODE', '')
    expect(consultationMailMode()).toBe('log')
    const r = await sendConsultationMail({ to: TEAM_INBOX, subject: 'S', template: 't', react: createElement('p') })
    expect(r).toMatchObject({ success: true, logged: true })
    expect(sendMail).not.toHaveBeenCalled()
    expect(loggedMail.at(-1)).toEqual({ to: TEAM_INBOX, subject: 'S', template: 't' })
  })
  it('any value other than exactly "send" still only logs', async () => {
    vi.stubEnv('CONSULTATION_MAIL_MODE', 'yes')
    await sendConsultationMail({ to: 'a@b.co', subject: 'S', template: 't', react: createElement('p') })
    expect(sendMail).not.toHaveBeenCalled()
  })
  it('team inbox is Cheke’s routing address', () => {
    expect(TEAM_INBOX).toBe('fplgn.dev.clients@gmail.com')
  })
})
