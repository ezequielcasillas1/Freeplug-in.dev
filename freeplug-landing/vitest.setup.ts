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
