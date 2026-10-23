import { sendMail } from '@/lib/email/mailer'
import { SUPPORT_EMAIL } from '@/lib/site'
import type { DowngradeRefundEvent } from './change-plan'

/** Owner alert text for a $100 -> $35 refund downgrade (internal only). Exported for tests. */
export function downgradeRefundAlert(o: DowngradeRefundEvent): { subject: string; text: string } {
  const usd = `$${(o.refundCents / 100).toFixed(2)}`
  const subject =
    o.outcome === 'done'
      ? `Downgrade $100 -> $35: ${usd} ${o.choice === 'refund' ? 'refunded to original payment method' : 'toward buyout'} (${o.subscriptionId})`
      : `ACTION NEEDED: ${usd} ${o.choice === 'refund' ? 'refunded' : 'set toward buyout'} but $100 -> $35 switch failed (${o.subscriptionId})`
  const text = [
    `Subscription: ${o.subscriptionId}`,
    `User: ${o.userId ?? 'unknown'}`,
    `Invoice: ${o.invoiceId}`,
    `Charge: ${o.chargeId}`,
    `Client choice: ${o.choice === 'refund' ? `Stripe refund to the original payment method ${o.refundId ?? 'existing (retry)'}` : 'toward buyout (no money moved)'} for ${usd}`,
    o.outcome === 'done' ? 'Switched to Starter ($35) now; new billing period starts today.' : `Still on $100. Error: ${o.error ?? 'unknown'}. A retry by the customer switches without refunding again.`,
    o.choice === 'refund' ? 'Buyout: the $50 left of the $100 counts toward ownership (net of the refund).' : 'Buyout: the full $100 paid keeps counting toward ownership.',
  ].join('\n')
  return { subject, text }
}

export async function sendDowngradeRefundAlert(o: DowngradeRefundEvent): Promise<void> {
  const { subject, text } = downgradeRefundAlert(o)
  const r = await sendMail({ to: SUPPORT_EMAIL, subject, text, template: 'downgrade-refund-alert', idempotencyKey: `downgrade-refund-alert:${o.subscriptionId}:${o.invoiceId}:${o.outcome}` })
  if (!r.success) throw new Error(`downgrade-refund alert not sent: ${r.reason}`)
}
