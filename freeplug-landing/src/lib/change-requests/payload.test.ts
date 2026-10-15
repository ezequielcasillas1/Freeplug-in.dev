import { describe, expect, it } from 'vitest'
import { buildChangeRequestPayload, PAYLOAD_V1_KEYS, webhookChangeType, type PayloadSource } from './payload'

const row: PayloadSource = {
  id: '6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13',
  business_name: 'Rivera Plumbing',
  change_type: 'Hours or contact info',
  page: 'Contact (ask maria@rivera.example)',
  description: 'New phone is (512) 555-0199 and email maria@rivera.example. Card on file 4242 4242 4242 4242 is fine.',
  photo_name: 'storefront.jpg',
  plan_step: 'starter',
  billing: 'included',
  created_at: '2026-10-04T20:05:00.000Z',
}

describe('buildChangeRequestPayload (v1)', () => {
  const p = buildChangeRequestPayload(row, 'https://freeplug-in.dev/')

  it('has exactly the v1 keys', () => {
    expect(Object.keys(p)).toEqual([...PAYLOAD_V1_KEYS])
  })

  it('matches the spec example shape', () => {
    expect(p).toEqual({
      v: 1,
      event: 'change_request.created',
      request_id: '6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13',
      business_name: 'Rivera Plumbing',
      change_type: 'Hours or contact info',
      page: 'Contact (ask [removed])',
      description: 'New phone is [removed] and email [removed]. Card on file [removed] is fine.',
      has_photo: true,
      plan_step: 'starter',
      billing: 'included',
      created_at: '2026-10-04T20:05:00.000Z',
      admin_url: 'https://freeplug-in.dev/admin/change-requests/6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13',
    })
  })

  it('carries no email, phone, user id, Stripe id or IP anywhere', () => {
    const json = JSON.stringify(p)
    expect(json).not.toMatch(/@/)
    expect(json).not.toMatch(/555|0199|4242/)
    expect(json).not.toMatch(/user_id|userId|cus_|sub_|pi_|stripe|ip_address/i)
    for (const k of Object.keys(p)) expect(k).not.toMatch(/email|phone|user|stripe|customer|(^|_)ip(_|$)/i)
  })

  it('does not change the stored row (only the payload is scrubbed)', () => {
    expect(row.description).toContain('(512) 555-0199')
    expect(row.page).toContain('maria@rivera.example')
  })

  it('has_photo is false without a photo name; plan_step may be null', () => {
    const q = buildChangeRequestPayload({ ...row, photo_name: null, plan_step: null, business_name: null }, 'http://localhost:3381')
    expect(q).toMatchObject({ has_photo: false, plan_step: null, business_name: '', admin_url: `http://localhost:3381/admin/change-requests/${row.id}` })
  })
})

describe('phase 5 L-2: change_type is validated for the webhook', () => {
  it.each(['Text or prices', 'Photos', 'Hours or contact info', 'Something else'])('keeps the allowed %j', (t) => {
    expect(buildChangeRequestPayload({ ...row, change_type: t }, 'https://x.example').change_type).toBe(t)
  })
  it.each(['call maria@rivera.example', '<script>x</script>', '', '   ', 'photos', 'Photos\n(512) 555-0199'])('anything else goes out as "Something else": %j', (t) => {
    const p = buildChangeRequestPayload({ ...row, change_type: t }, 'https://x.example')
    expect(p.change_type).toBe('Something else')
    expect(JSON.stringify(p)).not.toContain('maria@rivera.example')
  })
  it('trims surrounding whitespace of an allowed value', () => expect(webhookChangeType('  Photos ')).toBe('Photos'))
})
