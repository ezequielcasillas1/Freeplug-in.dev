/**
 * Unsubscribe links (Oct 19, Cheke). A link carries the recipient either as a signed token
 * (`?t=<b64url(email)>.<b64url(HMAC-SHA256(email, UNSUBSCRIBE_SECRET))>`) only.
 * The cold-email sender (/workspace/cold-email-sender/cold-email.js) signs with the same secret.
 * Web Crypto only, so it runs on Cloudflare Workers.
 */
export const UNSUBSCRIBE_PATH = '/unsubscribe'

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase()
  if (e.length < 3 || e.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null
  return e
}

const enc = new TextEncoder()
function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}
async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)))
}

export async function signUnsubscribeToken(email: string, secret: string): Promise<string> {
  const e = normalizeEmail(email)
  if (!e) throw new Error('invalid email')
  return `${b64url(enc.encode(e))}.${b64url(await hmac(secret, e))}`
}

export async function verifyUnsubscribeToken(token: string, secret: string | undefined): Promise<string | null> {
  if (!secret || typeof token !== 'string' || token.length > 1200) return null
  const [p, sig] = token.split('.')
  if (!p || !sig) return null
  const raw = fromB64url(p)
  const given = fromB64url(sig)
  if (!raw || !given) return null
  const e = normalizeEmail(new TextDecoder().decode(raw))
  if (!e) return null
  const want = await hmac(secret, e)
  if (want.length !== given.length) return null
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want[i] ^ given[i]
  return diff === 0 ? e : null
}

/** The recipient a link names: a valid SIGNED token only (Luma QA Oct 19: no plain-email links). */
export async function recipientFromParams(
  params: { t?: string | string[] },
  secret = process.env.UNSUBSCRIBE_SECRET
): Promise<{ email: string; kind: 'signed' } | null> {
  const t = Array.isArray(params.t) ? params.t[0] : params.t
  if (!t) return null
  const v = await verifyUnsubscribeToken(t, secret)
  return v ? { email: v, kind: 'signed' } : null
}
