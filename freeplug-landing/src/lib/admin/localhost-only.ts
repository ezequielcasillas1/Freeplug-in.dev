import 'server-only'

/**
 * Localhost-only gate for the widen log, the digest and /admin/templates (Aria ruling 3),
 * on top of assertAdminAccess. Layers:
 *  1. Production: always refused. The Worker never serves a loopback client, so these pages
 *     exist only on a local `next dev`.
 *  2. Socket: the picker's :3000 is started bound to 127.0.0.1 (start-next.sh BIND=127.0.0.1),
 *     so a non-loopback peer can't open a TCP connection to it at all. Next's app router doesn't
 *     expose the socket's remote address to pages, so this is enforced at bind time.
 *  3. Headers: Host must be loopback, and every forwarding header present (X-Forwarded-For,
 *     X-Real-IP, Forwarded, CF-Connecting-IP, True-Client-IP, X-Forwarded-Host) must be loopback
 *     too. A faked "Host: localhost" from a proxied remote still fails on XFF.
 */
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

export function isLoopbackAddress(raw: string): boolean {
  const a = raw.trim().replace(/^"|"$/g, '').replace(/^\[|\](:\d+)?$/g, '').replace(/^::ffff:/i, '').toLowerCase()
  return a === '127.0.0.1' || /^127\.\d+\.\d+\.\d+$/.test(a) || a === '::1' || a === 'localhost'
}

type HeaderGetter = { get(name: string): string | null }

export function isLocalhostRequest(h: HeaderGetter, env: { NODE_ENV?: string } = process.env): boolean {
  if (env.NODE_ENV === 'production') return false
  const host = (h.get('host') ?? '').trim()
  if (!LOOPBACK_HOST.test(host)) return false
  const xfh = h.get('x-forwarded-host')
  if (xfh && !xfh.split(',').every((v) => LOOPBACK_HOST.test(v.trim()))) return false
  for (const name of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip']) {
    const v = h.get(name)
    if (v && !v.split(',').every(isLoopbackAddress)) return false
  }
  const fwd = h.get('forwarded')
  if (fwd) {
    const fors = [...fwd.matchAll(/for=("?\[?[^;,"\]]+\]?"?)/gi)].map((m) => m[1])
    if (fors.length === 0 || !fors.every(isLoopbackAddress)) return false
  }
  return true
}
