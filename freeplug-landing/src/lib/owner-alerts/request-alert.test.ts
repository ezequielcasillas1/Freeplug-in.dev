import { afterEach, describe, expect, it, vi } from 'vitest'

const mail = vi.hoisted(() => ({ sendMail: vi.fn() }))
vi.mock('@/lib/email/mailer', () => ({ sendMail: mail.sendMail }))
import { alertRequest, DEFAULT_REQUEST_ALERT_EMAIL, renderRequestAlert, requestAlertRecipient, sendRequestAlert, type RequestAlert } from './request-alert'
import { ownerAlertRecipient } from './send'

const sample: RequestAlert = {
  kind: 'website_request',
  name: 'Ana Ruiz',
  email: 'ana@example.com',
  phone: '555-0100',
  business: 'Ruiz Auto',
  details: [['Google Business', 'https://g.page/ruiz'], ['Notes', 'Need 3 pages <b>fast</b>'], ['Language', 'English']],
  at: new Date('2026-10-22T15:30:00Z'),
}

afterEach(() => {
  vi.unstubAllEnvs()
  mail.sendMail.mockReset()
})

describe('request alert recipient', () => {
  it('defaults to fplgn.dev.clients@gmail.com', () => {
    vi.stubEnv('REQUEST_ALERT_EMAIL', '')
    expect(requestAlertRecipient()).toBe(DEFAULT_REQUEST_ALERT_EMAIL)
    expect(DEFAULT_REQUEST_ALERT_EMAIL).toBe('fplgn.dev.clients@gmail.com')
  })
  it('override via REQUEST_ALERT_EMAIL; "off"/invalid disables', () => {
    vi.stubEnv('REQUEST_ALERT_EMAIL', 'x@example.com')
    expect(requestAlertRecipient()).toBe('x@example.com')
    vi.stubEnv('REQUEST_ALERT_EMAIL', 'off')
    expect(requestAlertRecipient()).toBeNull()
  })
  it('does not change the owner alert recipient', () => {
    vi.stubEnv('OWNER_ALERT_EMAIL', 'fplgn.dev.72@gmail.com')
    vi.stubEnv('REQUEST_ALERT_EMAIL', '')
    expect(ownerAlertRecipient()).toBe('fplgn.dev.72@gmail.com')
  })
})

describe('request alert email', () => {
  it('has name, email, phone, business and the request fields; escapes HTML', () => {
    const r = renderRequestAlert(sample)
    expect(r.subject).toBe('New website request: Ana Ruiz (Ruiz Auto)')
    for (const s of ['Name: Ana Ruiz', 'Email: ana@example.com', 'Phone: 555-0100', 'Business: Ruiz Auto', 'Google Business: https://g.page/ruiz', 'Notes: Need 3 pages <b>fast</b>', 'Language: English', '10:30 AM CT'])
      expect(r.text).toContain(s)
    expect(r.html).not.toContain('<b>fast')
    expect(r.html).toContain('&lt;b&gt;fast')
  })
  it('omits phone when not given', () => {
    expect(renderRequestAlert({ ...sample, phone: null }).text).not.toContain('Phone:')
  })
  it('sends once to the recipient with an idempotency key and reply-to the customer', async () => {
    const send = vi.fn(async () => ({ success: true as const, id: 'em_1' }))
    expect(await sendRequestAlert(sample, 'website-request:r1:u', send)).toBe('sent')
    expect(send).toHaveBeenCalledTimes(1)
    const p = (send.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(p.to).toBe('fplgn.dev.clients@gmail.com')
    expect(p.idempotencyKey).toBe('request-alert:website-request:r1:u')
    expect(p.replyTo).toBe('ana@example.com')
    expect(p.template).toBe('request-alert')
  })
  it('never throws: failed result or thrown error -> "failed"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendRequestAlert(sample, 'k', async () => ({ success: false, reason: 'http' }) as never)).toBe('failed')
    expect(await sendRequestAlert(sample, 'k', async () => { throw new Error('boom') })).toBe('failed')
  })
  it('disabled -> nothing sent', async () => {
    vi.stubEnv('REQUEST_ALERT_EMAIL', 'off')
    const send = vi.fn()
    expect(await sendRequestAlert(sample, 'k', send)).toBe('disabled')
    expect(send).not.toHaveBeenCalled()
  })
})

describe('alertRequest (fire-and-forget)', () => {
  it('returns immediately, looks up the name, sends in the background', async () => {
    mail.sendMail.mockResolvedValue({ success: true, id: 'em_1' })
    const { name: _n, at: _a, ...rest } = sample
    void _n; void _a
    expect(alertRequest({ ...rest, resolveName: async () => 'Ana Ruiz', dedupeKey: 'd1' })).toBeUndefined()
    await vi.waitFor(() => expect(mail.sendMail).toHaveBeenCalledTimes(1))
    const p = mail.sendMail.mock.calls[0][0]
    expect(p.subject).toBe('New website request: Ana Ruiz (Ruiz Auto)')
    expect(p.idempotencyKey).toBe('request-alert:d1')
  })
  it('a rejecting mailer never escapes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mail.sendMail.mockRejectedValue(new Error('down'))
    expect(() => alertRequest({ kind: 'website_request', details: [], dedupeKey: 'd2', resolveName: async () => { throw new Error('no admin') } })).not.toThrow()
    await vi.waitFor(() => expect(mail.sendMail).toHaveBeenCalled())
  })
})
