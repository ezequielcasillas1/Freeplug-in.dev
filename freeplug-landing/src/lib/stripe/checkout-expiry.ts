/**
 * Every Checkout Session expires one hour after it is created (Aria, Oct 3 12:56; Stripe allows
 * 30 minutes to 24 hours). The value is now + 1 hour rounded DOWN to the whole minute, so a
 * double-click inside the same minute sends identical params under one idempotency key (Stripe
 * rejects a reused key with different params). The session therefore lives 59-60 minutes.
 */
export const CHECKOUT_SESSION_TTL_SECONDS = 3600

export function checkoutSessionExpiresAt(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 60_000) * 60 + CHECKOUT_SESSION_TTL_SECONDS
}
