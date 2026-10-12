import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SUPPORT_EMAIL } from '@/lib/site'
import type { OutreachPlanBox } from './outreach-dashboard'

/**
 * The outreach plan box (outreach-dashboard.ts): the card an outreach customer sees instead of a
 * plan list. The dashboard subscriptions box and /dashboard/cancel both render THIS component, so
 * the two pages look identical (Lina / Sable, round 12).
 *   choose_plan      -> red text link back to the claim steps ("Choose your hosting plan")
 *   plan_waiting     -> "You already chose a hosting plan. You won't be charged until your site goes live."
 *   plan_unavailable -> Sable's 3:27 line, plain grey, no button
 * `children` renders under the line inside the same card (the Cancel page's 4:03 help line).
 */
export function OutreachPlanCard({ box, children }: { box: Exclude<OutreachPlanBox, 'plan'>; children?: ReactNode }) {
  const t = useTranslations()
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm" data-testid="outreach-plan-card">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-gray-50 p-2">
          <CreditCard className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">{t('dashboard.home.activeSubscriptions')}</h2>
          {box === 'plan_unavailable' ? (
            <p className="text-gray-600" data-testid="plan-live-unavailable">
              {t('claim.planLiveUnavailableMessage', { supportEmail: SUPPORT_EMAIL })}
            </p>
          ) : box === 'plan_waiting' ? (
            <p className="text-gray-600" data-testid="plan-waiting">
              {t('claim.planWaitingForPublishMessage')}
            </p>
          ) : (
            <Link
              href="/claim"
              className="inline-flex items-center gap-1 font-semibold text-[#ba3d3d] hover:underline text-sm"
              data-testid="choose-plan-link"
            >
              {t('plans.ladderHeading')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
