import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDunningCheck, supabaseDunningStore } from '@/lib/billing/dunning'
import { getStripe } from '@/lib/stripe/server'

export const dynamic = 'force-dynamic'

/** Bearer CRON_SECRET; no secret configured = refused (never open). */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header?.startsWith('Bearer ')) return false
  const a = Buffer.from(header.slice(7))
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Daily failed-payment check (src/lib/billing/dunning.ts): grace -> past_due (day 14) -> paused (day 17).
 * Logs transitions only; sends no email and deletes nothing. Not scheduled anywhere yet.
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const r = await runDunningCheck({
    store: supabaseDunningStore(createAdminClient()),
    now: () => new Date(),
    // Stripe keeps a subscription with an unpaid invoice at past_due / unpaid; anything else = paid or ended.
    stillUnpaid: async (id) => ['past_due', 'unpaid', 'incomplete'].includes((await getStripe().subscriptions.retrieve(id)).status),
    onTransition: (t) => console.info('[dunning] transition', t.subscriptionId, `${t.from} -> ${t.to}`, `day ${t.day}`),
  })
  return NextResponse.json({ checked: r.checked, transitions: r.transitions.length, domainExpired: r.domainExpired.length, resolved: r.resolved.length })
}
