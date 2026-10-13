import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mail = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], result: { success: true, id: 'm1' } as Record<string, unknown> }))
vi.mock('@/lib/email/mailer', () => ({
  sendMail: async (p: Record<string, unknown>) => {
    mail.calls.push(p)
    return mail.result
  },
}))
import { adminAlertRecipients, rowFailedAlertText, sendRowFailedAlert } from './alert'

const A = { userId: 'u1', websiteRequestId: 'w1', businessName: 'Gracia Lawn', changeType: 'Photos', page: 'Home', reason: 'relation does not exist' }

describe('admin alert when the change_requests row fails (ruling 7)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    mail.calls = []
  })
  it('goes to every ADMIN_EMAILS address, says the change is safe in the notes, no Reply-To', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'a@x.dev, b@x.dev ,bad')
    expect(adminAlertRecipients()).toEqual(['a@x.dev', 'b@x.dev'])
    await sendRowFailedAlert(A)
    expect(mail.calls[0]).toMatchObject({ to: ['a@x.dev', 'b@x.dev'], replyTo: null, subject: 'Change request not saved to the list: Gracia Lawn' })
    expect(String(mail.calls[0].text)).toContain('IS saved in the website request notes')
    expect(String(mail.calls[0].text)).toContain('Error: relation does not exist')
  })
  it('no recipients -> logged, nothing sent; a mail failure never throws', async () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendRowFailedAlert(A)).toMatchObject({ success: false, reason: 'no_recipients' })
    vi.stubEnv('ADMIN_EMAILS', 'a@x.dev')
    mail.result = { success: false, reason: 'not_configured', error: 'x' }
    await expect(sendRowFailedAlert(A)).resolves.toMatchObject({ success: false })
    err.mockRestore()
  })
  it('caps the error text', () => {
    expect(rowFailedAlertText({ ...A, reason: 'e'.repeat(1000) }).text).toContain('e'.repeat(300) + '\n')
  })
})
