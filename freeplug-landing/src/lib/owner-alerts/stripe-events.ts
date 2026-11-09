import type Stripe from 'stripe'
import { stepByLookupKey, isPlanStepId, stepById, type PlanStep } from '@/lib/plans/ladder'
import { usd, type OwnerAlert, type OwnerAlertKind } from './format'

const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : null)

function stepOfItems(items: { data?: Array<{ price?: { lookup_key?: string | null } | null }> } | null | undefined, meta?: Record<string, string> | null): PlanStep | null {
  for (const it of items?.data ?? []) {
    const s = stepByLookupKey(it?.price?.lookup_key ?? null)
    if (s) return s
  }
  return isPlanStepId(meta?.plan_step) ? stepById(meta!.plan_step as Parameters<typeof stepById>[0]) : null
}

const date = (unix: number | null | undefined) =>
  unix ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(unix * 1000)) : null

export type StripeOwnerAlert = { kind: OwnerAlertKind; customerId: string | null; details: OwnerAlert['details']; adminPath?: string }

/**
 * Which owner alert (if any) a Stripe event is. Pure. One alert per refund (refund.created, not also
 * charge.refunded), per dispute open/close, per plan change; renewals and other updates send none.
 */
export function ownerAlertForStripeEvent(event: Pick<Stripe.Event, 'type' | 'data'>): StripeOwnerAlert | null {
  const obj = event.data.object as unknown as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const prev = (event.data as { previous_attributes?: Record<string, any> }).previous_attributes ?? {} // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customerId = idOf(obj.customer)
      const step = stepOfItems(obj.items, obj.metadata)
      const planLine: [string, string | null] = ['Plan', step ? `${step.name} (${usd(step.monthlyCents)}/mo)` : null]
      if (event.type === 'customer.subscription.deleted') return { kind: 'plan_canceled', customerId, details: [planLine, ['Status', 'Subscription ended']] }
      if (event.type === 'customer.subscription.created') {
        return obj.status === 'active' || obj.status === 'trialing' ? { kind: 'plan_purchased', customerId, details: [planLine] } : null
      }
      if ('status' in prev && (prev.status === 'incomplete' || prev.status === 'incomplete_expired') && (obj.status === 'active' || obj.status === 'trialing')) {
        return { kind: 'plan_purchased', customerId, details: [planLine] }
      }
      if ('status' in prev && prev.status !== obj.status && (obj.status === 'past_due' || obj.status === 'unpaid')) {
        return { kind: 'payment_failed', customerId, details: [planLine, ['Status', String(obj.status).replace('_', ' ')]] }
      }
      const cancelNow = Boolean(obj.cancel_at_period_end) || Boolean(obj.cancel_at)
      const cancelBefore = ('cancel_at_period_end' in prev ? Boolean(prev.cancel_at_period_end) : Boolean(obj.cancel_at_period_end)) || ('cancel_at' in prev ? Boolean(prev.cancel_at) : Boolean(obj.cancel_at))
      if (cancelNow && !cancelBefore) {
        return { kind: 'plan_canceled', customerId, details: [planLine, ['Ends', date(obj.cancel_at ?? obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end)], ['Reason', obj.cancellation_details?.feedback ?? obj.cancellation_details?.comment ?? null]] }
      }
      if (prev.items) {
        const before = stepOfItems(prev.items, null)
        if (before && step && before.id !== step.id) {
          return {
            kind: step.rank > before.rank ? 'plan_upgraded' : 'plan_downgraded',
            customerId,
            details: [['From', `${before.name} (${usd(before.monthlyCents)}/mo)`], ['To', `${step.name} (${usd(step.monthlyCents)}/mo)`]],
          }
        }
      }
      return null
    }
    case 'invoice.paid':
      if (!obj.metadata?.maintenance_quote_id) return null
      return { kind: 'maintenance_quote_paid', customerId: idOf(obj.customer), details: [['Amount', usd(obj.amount_paid)], ['Invoice', obj.number ?? null]], adminPath: '/admin/change-requests' }
    case 'refund.created':
    case 'refund.failed':
      return {
        kind: event.type === 'refund.created' ? 'refund' : 'refund_failed',
        customerId: idOf(obj.customer) ?? idOf(obj.charge?.customer),
        details: [['Amount', usd(obj.amount)], ['Reason', obj.reason ?? null], ['Status', obj.status ?? null]],
      }
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
      return {
        kind: event.type === 'charge.dispute.created' ? 'dispute_opened' : 'dispute_closed',
        customerId: idOf(obj.charge?.customer) ?? idOf(obj.customer),
        details: [['Amount', usd(obj.amount)], ['Reason', obj.reason ?? null], ['Status', obj.status ?? null], ['Respond by', date(obj.evidence_details?.due_by)]],
      }
    default:
      return null
  }
}
