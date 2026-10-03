/**
 * Cloudflare Turnstile check for every preview form (Aria, section 4).
 * Real keys come from env only: NEXT_PUBLIC_TURNSTILE_SITE_KEY (browser widget) and
 * TURNSTILE_SECRET_KEY (server).
 *   * production without TURNSTILE_SECRET_KEY: fails closed (every preview form is refused);
 *   * development / test without keys: Cloudflare's official always-pass test keys
 *     (https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
 */
import { isTrustedClientIp } from '@/lib/rate-limit/client-ip'

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
/** Cloudflare's documented test keys ("always passes"). Never used when NODE_ENV=production. */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
export const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'

export function turnstileSecret(env: { secret?: string; nodeEnv?: string } = {}): string | null {
  const secret = ('secret' in env ? env.secret : process.env.TURNSTILE_SECRET_KEY)?.trim()
  if (secret) return secret
  const nodeEnv = 'nodeEnv' in env ? env.nodeEnv : process.env.NODE_ENV
  return nodeEnv === 'development' || nodeEnv === 'test' ? TURNSTILE_TEST_SECRET_KEY : null
}

type Opts = {
  secret?: string | undefined
  nodeEnv?: string | undefined
  fetchImpl?: typeof fetch
}

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp: string | null | undefined,
  opts: Opts = {}
): Promise<boolean> {
  const env: { secret?: string; nodeEnv?: string } = {}
  if ('secret' in opts) env.secret = opts.secret
  if ('nodeEnv' in opts) env.nodeEnv = opts.nodeEnv
  const secret = turnstileSecret(env)
  if (!secret) return false
  if (!token || token.length > 2048) return false
  const body = new URLSearchParams({ secret, response: token })
  // The shared bucket isn't an address, so Cloudflare doesn't get it (Vera r2 N6).
  if (isTrustedClientIp(remoteIp)) body.set('remoteip', remoteIp)
  try {
    const res = await (opts.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
      cache: 'no-store',
    })
    if (!res.ok) return false
    const json = (await res.json()) as { success?: boolean }
    return json.success === true
  } catch {
    return false
  }
}
