// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SHARED_IP_BUCKET, TRUST_CF_CONNECTING_IP_ENV, clientIpFrom, isTrustedClientIp } from './client-ip'

const h = (o: Record<string, string>) => new Headers(o)
const on = { TRUST_CF_CONNECTING_IP: 'true' }

describe('client IP for rate limits on Cloudflare (Vera QA #3, Aria A5, Oct 3)', () => {
  it('the shared bucket is still "unknown-ip" and the flag name is TRUST_CF_CONNECTING_IP', () => {
    expect(SHARED_IP_BUCKET).toBe('unknown-ip')
    expect(TRUST_CF_CONNECTING_IP_ENV).toBe('TRUST_CF_CONNECTING_IP')
  })

  it('flag on with a valid CF-Connecting-IP (IPv4 or IPv6): that IP', () => {
    expect(clientIpFrom(h({ 'cf-connecting-ip': '198.51.100.9' }), on)).toBe('198.51.100.9')
    expect(clientIpFrom(h({ 'cf-connecting-ip': ' 203.0.113.7 ' }), on)).toBe('203.0.113.7')
    expect(clientIpFrom(h({ 'cf-connecting-ip': '2001:db8:1:2::abcd' }), on)).toBe('2001:db8:1:2::abcd')
  })

  it('flag on with no header, a blank one or garbage: the shared bucket', () => {
    for (const v of [undefined, '', '   ', 'not-an-ip', '1.2.3.4, 5.6.7.8', '999.1.1.1', '1.2.3', 'fe80::1%eth0', '<script>', 'unknown-ip']) {
      expect(clientIpFrom(h(v === undefined ? {} : { 'cf-connecting-ip': v }), on)).toBe(SHARED_IP_BUCKET)
    }
  })

  it('flag on with only X-Forwarded-For / X-Real-IP / the old Netlify header: the shared bucket (no fallback)', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': '1.2.3.4' }), on)).toBe(SHARED_IP_BUCKET)
    expect(clientIpFrom(h({ 'x-real-ip': '1.2.3.4' }), on)).toBe(SHARED_IP_BUCKET)
    expect(clientIpFrom(h({ 'x-nf-client-connection-ip': '198.51.100.9' }), { ...on, TRUST_NETLIFY_IP_HEADER: 'true', TRUST_PROXY_HEADERS: 'true' })).toBe(SHARED_IP_BUCKET)
    // CF-Connecting-IP wins over a faked XFF.
    expect(clientIpFrom(h({ 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4' }), on)).toBe('198.51.100.9')
  })

  it('flag off (unset, "", "1", "TRUE", "false"): a sent CF-Connecting-IP is ignored', () => {
    for (const env of [{}, { TRUST_CF_CONNECTING_IP: '' }, { TRUST_CF_CONNECTING_IP: '1' }, { TRUST_CF_CONNECTING_IP: 'TRUE' }, { TRUST_CF_CONNECTING_IP: 'false' }]) {
      expect(clientIpFrom(h({ 'cf-connecting-ip': '198.51.100.9' }), env)).toBe(SHARED_IP_BUCKET)
    }
  })

  it('flag off: rotating the header does not escape the limit (40 values, one bucket)', () => {
    const ips = Array.from({ length: 40 }, (_, i) => clientIpFrom(h({ 'cf-connecting-ip': `203.0.113.${i}`, 'x-forwarded-for': `10.0.0.${i}` }), {}))
    expect(new Set(ips)).toEqual(new Set([SHARED_IP_BUCKET]))
  })

  it('is documented in .env.example without a value; the Netlify and proxy flags are gone', () => {
    const example = readFileSync(path.join(__dirname, '../../../.env.example'), 'utf8')
    expect(example).toMatch(/^TRUST_CF_CONNECTING_IP=$/m)
    expect(example).not.toMatch(/TRUST_NETLIFY_IP_HEADER/)
    expect(example).not.toMatch(/^TRUST_PROXY_HEADERS=/m)
  })

  it('the source has no X-Forwarded-For, X-Real-IP or Netlify branch left', () => {
    const src = readFileSync(path.join(__dirname, 'client-ip.ts'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('/'))
    expect(src.join('\n')).not.toMatch(/x-forwarded-for|x-real-ip|x-nf-client|TRUST_NETLIFY|TRUST_PROXY/i)
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
