// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SHARED_IP_BUCKET, clientIpFrom, isTrustedClientIp } from './client-ip'

const h = (o: Record<string, string>) => new Headers(o)

describe('client IP for rate limits (Vera QA #3, refined 12:49 AM)', () => {
  it('fake X-Forwarded-For without the Netlify header: the shared bucket, never the faked value', () => {
    expect(SHARED_IP_BUCKET).toBe('unknown-ip')
    const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((ip) => clientIpFrom(h({ 'x-forwarded-for': ip, 'x-real-ip': ip }), {}))
    // Rotating the header lands every request in the same bucket, so the limit still applies.
    expect(new Set(ips)).toEqual(new Set([SHARED_IP_BUCKET]))
  })

  it('fake X-Forwarded-For plus the Netlify header, with TRUST_NETLIFY_IP_HEADER=true: Netlify’s connection IP wins', () => {
    expect(clientIpFrom(h({ 'x-nf-client-connection-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4' }), { TRUST_NETLIFY_IP_HEADER: 'true' })).toBe('198.51.100.9')
  })

  it('neither header: the shared bucket', () => {
    expect(clientIpFrom(h({}), {})).toBe(SHARED_IP_BUCKET)
  })

  it('the trusted-proxy flag is off by default and only exactly "true" turns it on', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': '1.2.3.4' }), {})).toBe(SHARED_IP_BUCKET)
    expect(clientIpFrom(h({ 'x-forwarded-for': '1.2.3.4' }), { TRUST_PROXY_HEADERS: '1' })).toBe(SHARED_IP_BUCKET)
    expect(clientIpFrom(h({ 'x-forwarded-for': '1.2.3.4' }), { TRUST_PROXY_HEADERS: 'false' })).toBe(SHARED_IP_BUCKET)
  })

  it('with TRUST_PROXY_HEADERS=true: first X-Forwarded-For entry, then X-Real-IP; Netlify still wins', () => {
    const env = { TRUST_PROXY_HEADERS: 'true' }
    expect(clientIpFrom(h({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), env)).toBe('203.0.113.7')
    expect(clientIpFrom(h({ 'x-real-ip': '203.0.113.8' }), env)).toBe('203.0.113.8')
    expect(clientIpFrom(h({}), env)).toBe(SHARED_IP_BUCKET)
    expect(clientIpFrom(h({ 'x-nf-client-connection-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4' }), env)).toBe('1.2.3.4')
    expect(clientIpFrom(h({ 'x-nf-client-connection-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4' }), { ...env, TRUST_NETLIFY_IP_HEADER: 'true' })).toBe('198.51.100.9')
  })
})

describe('TRUST_NETLIFY_IP_HEADER (Vera r2 N6, Jace round 5)', () => {
  it('off (unset, or anything but exactly "true"): a sent x-nf-client-connection-ip is ignored -> shared bucket', () => {
    for (const env of [{}, { TRUST_NETLIFY_IP_HEADER: '' }, { TRUST_NETLIFY_IP_HEADER: '1' }, { TRUST_NETLIFY_IP_HEADER: 'TRUE' }, { TRUST_NETLIFY_IP_HEADER: 'false' }]) {
      expect(clientIpFrom(h({ 'x-nf-client-connection-ip': '198.51.100.9' }), env)).toBe(SHARED_IP_BUCKET)
    }
  })

  it('off: rotating the Netlify header does not escape the limit (40 values, one bucket)', () => {
    const ips = Array.from({ length: 40 }, (_, i) => clientIpFrom(h({ 'x-nf-client-connection-ip': `203.0.113.${i}` }), {}))
    expect(new Set(ips)).toEqual(new Set([SHARED_IP_BUCKET]))
  })

  it('on: the Netlify header is used; missing or blank falls back to the existing path', () => {
    const on = { TRUST_NETLIFY_IP_HEADER: 'true' }
    expect(clientIpFrom(h({ 'x-nf-client-connection-ip': ' 198.51.100.9 ' }), on)).toBe('198.51.100.9')
    expect(clientIpFrom(h({ 'x-nf-client-connection-ip': '   ' }), on)).toBe(SHARED_IP_BUCKET)
    expect(clientIpFrom(h({ 'x-forwarded-for': '1.2.3.4' }), on)).toBe(SHARED_IP_BUCKET)
    expect(clientIpFrom(h({ 'x-forwarded-for': '1.2.3.4' }), { ...on, TRUST_PROXY_HEADERS: 'true' })).toBe('1.2.3.4')
  })

  it('is documented in .env.example without a value', () => {
    const example = readFileSync(path.join(__dirname, '../../../.env.example'), 'utf8')
    expect(example).toMatch(/^TRUST_NETLIFY_IP_HEADER=$/m)
    expect(example).toMatch(/^TRUST_PROXY_HEADERS=$/m)
  })
})

describe('isTrustedClientIp (Vera r2 N6)', () => {
  it('is false for the shared bucket and empty values, true for an address', () => {
    expect(isTrustedClientIp(SHARED_IP_BUCKET)).toBe(false)
    expect(isTrustedClientIp('')).toBe(false)
    expect(isTrustedClientIp(null)).toBe(false)
    expect(isTrustedClientIp('203.0.113.9')).toBe(true)
  })
})
