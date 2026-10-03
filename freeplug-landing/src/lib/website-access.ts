import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { formatBillingDate, stripeTimestampToDate, subscriptionPeriodEnd } from '@/lib/stripe/subscription-dates'

/**
 * Website access rule (Ezequiel, Sep 25, 2026): hosting is required. A customer can cancel hosting
 * at any time; the website stays online until the paid period ends, then goes offline. Paying for
 * hosting again brings it back. There is no minimum term.
 *
 * Worked out from Stripe subscriptions on every read (no stored flag, no schema change), so it is
 * correct as soon as Stripe changes the subscription. Taking a site offline stays manual (admin
 * customers table shows who is offline).
 */
export type WebsiteAccessStatus = 'active' | 'ending' | 'offline'

export type WebsiteAccess = {
  status: WebsiteAccessStatus
  /** When access ends: set only for 'ending' (the paid period end or cancel_at). */
  accessEndsAt: Date | null
  /** False when the customer never had a hosting subscription (nothing to take down or show). */
  hasHostingHistory: boolean
}

/** The fields of a Stripe subscription the rule needs (easy to build in tests). */
export type AccessSubscription = {
  id?: string
  status: Stripe.Subscription.Status | string
  cancelAtPeriodEnd: boolean
  cancelAt: Date | null
  currentPeriodEnd: Date | null
}

/**
 * Subscription statuses that keep the website online.
 * past_due / unpaid (card failed, Stripe is retrying) count as active on purpose: the site stays up
 * and access only comes off once Stripe actually cancels or ends the subscription.
 * TODO(Ezequiel): pending confirmation that failed payments should keep the site online.
 */
export const ACCESS_GRANTING_STATUSES: ReadonlyArray<string> = [
  'active',
  'trialing',
  'past_due', // pending Ezequiel's confirmation (see above)
  'unpaid', // pending Ezequiel's confirmation (see above)
]

/** Statuses that mean the customer paid for hosting at some point (so an offline site is real). */
const HAD_HOSTING_STATUSES: ReadonlyArray<string> = [...ACCESS_GRANTING_STATUSES, 'canceled', 'paused']

/** When a scheduled-to-end subscription stops: cancel_at if set, otherwise the period end. */
function scheduledEnd(sub: AccessSubscription): Date | null {
  return sub.cancelAt ?? sub.currentPeriodEnd
}

function isScheduledToEnd(sub: AccessSubscription): boolean {
  return sub.cancelAtPeriodEnd || sub.cancelAt != null
}

/** Pure rule. `now` is injectable for tests. */
export function computeWebsiteAccess(
  subscriptions: ReadonlyArray<AccessSubscription>,
  now: Date = new Date()
): WebsiteAccess {
  const hasHostingHistory = subscriptions.some((s) => HAD_HOSTING_STATUSES.includes(s.status))
  const live = subscriptions.filter((s) => ACCESS_GRANTING_STATUSES.includes(s.status))

  // Any live subscription that is not set to end keeps the site online. This is also what a
  // resume does (Stripe clears cancel_at_period_end), so cancel-then-resume is 'active' again.
  if (live.some((s) => !isScheduledToEnd(s))) {
    return { status: 'active', accessEndsAt: null, hasHostingHistory: true }
  }

  // Canceled but still paid up: online until the latest scheduled end. Access ends at the period
  // end, not when the customer clicks Cancel. If Stripe hasn't flipped the status yet but the end
  // has passed, treat it as offline.
  let accessEndsAt: Date | null = null
  let unknownEnd = false
  for (const s of live) {
    const end = scheduledEnd(s)
    if (!end) unknownEnd = true
    else if (!accessEndsAt || end > accessEndsAt) accessEndsAt = end
  }
  if (live.length > 0 && (unknownEnd || (accessEndsAt && accessEndsAt > now))) {
    return { status: 'ending', accessEndsAt: unknownEnd ? null : accessEndsAt, hasHostingHistory: true }
  }

  return { status: 'offline', accessEndsAt: null, hasHostingHistory }
}

/** Maps a Stripe subscription to the fields the rule needs. */
export function toAccessSubscription(sub: Stripe.Subscription): AccessSubscription {
  return {
    id: sub.id,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    cancelAt: stripeTimestampToDate(sub.cancel_at),
    currentPeriodEnd: subscriptionPeriodEnd(sub),
  }
}

/** Website access for a Stripe customer (null customer = never bought hosting). Throws if Stripe is unreachable. */
export async function getWebsiteAccessForCustomer(
  customerId: string | null | undefined,
  now: Date = new Date()
): Promise<WebsiteAccess> {
  if (!customerId) return { status: 'offline', accessEndsAt: null, hasHostingHistory: false }
  const res = await getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return computeWebsiteAccess(res.data.map(toAccessSubscription), now)
}

// ---------------------------------------------------------------------------------------------
// Copy from Sable (Sep 25, 2026). Use exactly; {accessEndDate} = formatBillingDate (same format as
// the renewal date on the dashboard card). Kept as constants so Sable can swap them in one place.
// ---------------------------------------------------------------------------------------------

export const ACCESS_ENDING_MESSAGE =
  'Your hosting is canceled. Your website stays online until {accessEndDate}, then goes offline. Resume your plan before then to keep it online.'
export const ACCESS_OFFLINE_MESSAGE =
  'Your website is offline because your hosting was canceled. Sign up for hosting again to bring it back.'
export const RESTART_HOSTING_LABEL = 'Restart hosting'
export const RESUME_PLAN_LABEL = 'Resume plan'
/** Existing hosting checkout (Plans page). */
export const RESTART_HOSTING_HREF = '/dashboard/plans'
/** Cancel page, directly above the Cancel button. Sable may revise it. */
export const CANCEL_ACCESS_WARNING =
  'If you cancel, your website stays online until {accessEndDate} and then goes offline. You can bring it back by signing up for hosting again.'
/** Cancel page "Ready to resume?" box while the canceled plan is still running ({accessEndDate} = end). */
export const CANCEL_RESUME_UNTIL_TEXT =
  'You can resume your plan until {accessEndDate}. After that, your website is saved, and you can bring it back by signing up for hosting again.'
/** Cancel page resume box heading while the canceled plan is still running (Sable, Sep 25 3:30 PM: sentence case). */
export const CANCEL_RESUME_HEADING = 'Ready to resume?'
/** Cancel page resume box heading once the website is offline (Vera, Sable, Sep 25). */
export const CANCEL_OFFLINE_HEADING = 'Bring your website back'
/** Same box when the customer is already offline. */
export const CANCEL_OFFLINE_SAVED_TEXT =
  'Your website is saved, and you can bring it back by signing up for hosting again.'
export const ADMIN_ACCESS_ACTIVE_LABEL = 'Website active'
export const ADMIN_ACCESS_ENDING_LABEL = 'Website active until {accessEndDate}'
export const ADMIN_ACCESS_OFFLINE_LABEL = 'Website offline (hosting canceled)'

/** Splits a template around {accessEndDate} so the UI can bold only the date. */
export function splitAccessTemplate(
  template: string,
  accessEndsAt: Date | null
): { before: string; date: string; after: string } {
  const [before, after = ''] = template.split('{accessEndDate}')
  return { before, date: formatBillingDate(accessEndsAt), after }
}

/** Fills {accessEndDate} with the formatted date (fallback text when the date is missing). */
export function fillAccessTemplate(template: string, accessEndsAt: Date | null): string {
  const { before, date, after } = splitAccessTemplate(template, accessEndsAt)
  return template.includes('{accessEndDate}') ? `${before}${date}${after}` : template
}

/** Admin badge label for a status. */
export function adminAccessLabel(access: WebsiteAccess): string {
  if (access.status === 'active') return ADMIN_ACCESS_ACTIVE_LABEL
  if (access.status === 'ending') return fillAccessTemplate(ADMIN_ACCESS_ENDING_LABEL, access.accessEndsAt)
  return ADMIN_ACCESS_OFFLINE_LABEL
}

/**
 * Status right after a customer.subscription.created/updated/deleted webhook: the customer's other
 * subscriptions from Stripe plus the event's copy of this one (fresher than a list call). If
 * Stripe can't be listed, falls back to the event's subscription alone.
 */
export async function websiteAccessAfterSubscriptionEvent(
  sub: Stripe.Subscription,
  now: Date = new Date()
): Promise<WebsiteAccess> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  let others: Stripe.Subscription[] = []
  if (customerId) {
    try {
      const res = await getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
      others = res.data.filter((s) => s.id !== sub.id)
    } catch (e) {
      console.error('[website-access] subscription list failed', e instanceof Error ? e.message : e)
    }
  }
  return computeWebsiteAccess([...others, sub].map(toAccessSubscription), now)
}

/** Dashboard alert for the customer's state (Lina: exactly one button, never both). */
export type WebsiteAccessAlert = {
  status: 'ending' | 'offline'
  /** Message split around the date so the UI can style it; date is null when there is none. */
  before: string
  date: string | null
  after: string
  button:
    | { kind: 'resume'; label: typeof RESUME_PLAN_LABEL }
    | { kind: 'checkout'; label: typeof RESTART_HOSTING_LABEL; href: string }
}

export function websiteAccessAlert(access: WebsiteAccess | null): WebsiteAccessAlert | null {
  if (!access || access.status === 'active' || !access.hasHostingHistory) return null
  if (access.status === 'ending') {
    const { before, date, after } = splitAccessTemplate(ACCESS_ENDING_MESSAGE, access.accessEndsAt)
    return { status: 'ending', before, date, after, button: { kind: 'resume', label: RESUME_PLAN_LABEL } }
  }
  return {
    status: 'offline',
    before: ACCESS_OFFLINE_MESSAGE,
    date: null,
    after: '',
    button: { kind: 'checkout', label: RESTART_HOSTING_LABEL, href: RESTART_HOSTING_HREF },
  }
}
