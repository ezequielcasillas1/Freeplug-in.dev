import type { AppLocale } from '@/i18n/config'
import { translatorFor, type Translate } from '@/i18n/translate'
import { formatPlanEndDate } from '@/lib/stripe/active-subscription'
import { dunningView, type DunningCase, type DunningView } from './dunning'

/** Where "Pay now" goes: the Plans page (update card / pay the open invoice). */
export const DUNNING_PAY_HREF = '/dashboard/plans'

export type DunningAlert = { id: string; type: 'info' | 'warning'; title: string; message: string; actionLabel: string; actionHref: string }

/** Dashboard notice for an open failed-payment case: gentle in grace, firmer past due, paused (saved, not deleted). */
export function dunningAlert(v: DunningView | null, locale: AppLocale = 'en', t: Translate = translatorFor(locale)): DunningAlert | null {
  if (!v) return null
  const base = { actionLabel: t('dashboard.dunning.payNow'), actionHref: DUNNING_PAY_HREF }
  if (v.state === 'grace') return { id: 'dunning-grace', type: 'info', title: t('dashboard.dunning.graceTitle'), message: t('dashboard.dunning.graceMessage', { date: formatPlanEndDate(v.pastDueAt, locale) }), ...base }
  if (v.state === 'past_due') return { id: 'dunning-past-due', type: 'warning', title: t('dashboard.dunning.pastDueTitle'), message: t('dashboard.dunning.pastDueMessage', { date: formatPlanEndDate(v.pauseAt, locale) }), ...base }
  return { id: 'dunning-paused', type: 'warning', title: t('dashboard.dunning.pausedTitle'), message: t('dashboard.dunning.pausedMessage'), ...base }
}

type Db = { from(t: string): any } // eslint-disable-line @typescript-eslint/no-explicit-any
/** The signed-in client's open case (RLS: own rows only). A failed read = null (no notice), logged. */
export async function fetchOpenDunningView(db: Db, userId: string, now: Date = new Date()): Promise<DunningView | null> {
  try {
    const { data, error } = await db.from('hosting_dunning').select('first_failed_at, domain_expires_at, resolved_at').eq('profile_id', userId).order('first_failed_at', { ascending: true }).limit(20)
    if (error) {
      console.error('[dashboard] hosting_dunning read failed', { code: error.code ?? null, message: error.message ?? null })
      return null
    }
    const row = (data as (Pick<DunningCase, 'first_failed_at' | 'domain_expires_at' | 'resolved_at'>)[] | null)?.find((r) => !r.resolved_at)
    return row ? dunningView(row, now) : null
  } catch (e) {
    console.error('[dashboard] hosting_dunning read failed', e instanceof Error ? e.message : e)
    return null
  }
}
