import '@testing-library/jest-dom/vitest'

// Resend primary (Oct 3): no test may reach the real Resend API. Tests use a fake `resend` client;
// this makes any direct fetch to api.resend.com fail loudly instead.
const realFetch = globalThis.fetch
if (realFetch) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (/^https?:\/\/([^/]*\.)?resend\.com(\/|$|:)/i.test(url)) {
      return Promise.reject(new Error(`Blocked in tests: request to ${new URL(url).host} (use a fake Resend client)`))
    }
    return realFetch(input, init)
  }) as typeof fetch
}

// Spanish build (Oct 4): next-intl without a provider in every test (test/intl-mock.tsx). English
// by default, so word-for-word copy tests now check messages/en.json, the English lock (card C1).
import { vi, beforeEach } from 'vitest'
vi.mock('next-intl', async () => (await import('./test/intl-mock')).nextIntlMock)
vi.mock('next-intl/server', async () => (await import('./test/intl-mock')).nextIntlServerMock)
beforeEach(async () => {
  ;(await import('./test/intl-mock')).setTestLocale('en')
})
vi.mock('@/i18n/navigation', async () => (await import('./test/intl-mock')).navigationMock)
// Layouts now import the document (fonts) directly; next/font only works inside Next's compiler.
vi.mock('next/font/google', () => {
  const font = () => ({ className: '', variable: '', style: { fontFamily: 'sans-serif' } })
  return { Geist: font, Geist_Mono: font }
})
