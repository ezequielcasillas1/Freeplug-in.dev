import 'server-only'
import type { ChangeRequestPayloadV1 } from './payload'

/**
 * Change-request webhook (Aria spec, item 3; header confirmed by Grok Bot, Oct 4 ~3 PM CT).
 * Server only: CHANGE_APPROVAL_WEBHOOK_URL and CHANGE_APPROVAL_WEBHOOK_KEY are never NEXT_PUBLIC_
 * and never logged. One try, 5 s timeout. The header is `Authorization: Bearer <key>`; a pasted key
 * that already starts with "Bearer " is used without that prefix, so it is never "Bearer Bearer".
 */
export const CHANGE_WEBHOOK_TIMEOUT_MS = 5000
export const CHANGE_WEBHOOK_NOT_CONFIGURED = 'Not sent: webhook not configured'

/** Trim, then drop any leading "Bearer " (any case, repeated), then trim again. '' = no key. */
export function normalizeWebhookKey(raw: string | null | undefined): string {
  let key = (raw ?? '').trim()
  while (/^bearer(\s+|$)/i.test(key)) key = key.replace(/^bearer\s*/i, '').trim()
  return key
}

export function webhookAuthHeader(key: string): string {
  return `Bearer ${normalizeWebhookKey(key)}`
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/i

/** https only (plain http only for a loopback receiver, e.g. the local fake). Anything else: null. */
export function parseWebhookUrl(raw: string | null | undefined): URL | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  let url: URL
  try {
    url = new URL(t)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  if (url.protocol === 'https:') return url
  if (url.protocol === 'http:' && LOOPBACK.test(url.hostname)) return url
  return null
}

export type WebhookConfig = { url: URL; key: string }

/** null when either env var is unset, blank or invalid (the caller skips quietly and logs it). */
export function changeWebhookConfig(env: Record<string, string | undefined> = process.env): WebhookConfig | null {
  const url = parseWebhookUrl(env.CHANGE_APPROVAL_WEBHOOK_URL)
  const key = normalizeWebhookKey(env.CHANGE_APPROVAL_WEBHOOK_KEY)
  if (!url || !key) return null
  return { url, key }
}

export type WebhookResult = { ok: true; status: number } | { ok: false; error: string }

/**
 * POSTs the payload once. Never throws. The error text never includes the URL or the key (it is
 * stored in change_requests.notify_error and shown on /admin).
 */
export async function postChangeRequestWebhook(
  config: WebhookConfig,
  payload: ChangeRequestPayloadV1,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<WebhookResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? CHANGE_WEBHOOK_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(config.url.toString(), {
      method: 'POST',
      headers: {
        Authorization: webhookAuthHeader(config.key),
        'Content-Type': 'application/json',
        'User-Agent': 'freeplug-change-requests/1',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // A redirect is a failure (the key must only go to the configured URL).
      redirect: 'manual',
      cache: 'no-store',
    })
    try {
      await res.body?.cancel()
    } catch {
      // body already consumed or not cancellable
    }
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status }
    return { ok: false, error: `HTTP ${res.status}` }
  } catch (e) {
    if (controller.signal.aborted) return { ok: false, error: `Timed out after ${timeoutMs / 1000}s` }
    const name = e instanceof Error ? e.name : 'Error'
    return { ok: false, error: `Network error (${name})` }
  } finally {
    clearTimeout(timer)
  }
}
