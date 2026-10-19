import type { BuyoutRequestResult } from '@/lib/buyout/buyout'
import type { WebsiteAccess } from '@/lib/website-access'
import { useLocale, useTranslations } from 'next-intl'
import { showBuyoutCard } from '@/lib/buyout/buyout'
import { BuyoutTiers } from './BuyoutTiers'
import type { BuyoutTierId } from '@/lib/buyout/tiers'
import { OWNERSHIP_COPY_ES, OWNERSHIP_NOTE, paidTowardOwnershipLine, stillClearingLine } from '@/lib/buyout/ownership'

export type OwnershipSummary = { paidCents: number; clearingCents: number } | null

type Props = {
  /** 'dashboard' = "Want to keep your website?" card; 'cancel' = "Keep your website" card. */
  variant: 'dashboard' | 'cancel'
  alreadyRequested: boolean
  onRequest: (tierId?: BuyoutTierId) => Promise<BuyoutRequestResult>
  className?: string
  /** Oct 18: "Paid toward ownership" (dashboard only); null hides it. */
  ownership?: OwnershipSummary
}

/** Plain card: dashboard card style on the dashboard, benefit-card style on the cancel page. */
export function BuyoutCard({ variant, alreadyRequested, onRequest, className = '', ownership = null }: Props) {
  const dashboard = variant === 'dashboard'
  const t = useTranslations('buyout')
  const es = useLocale() === 'es'
  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white ${dashboard ? 'p-6 shadow-sm' : 'p-5'} ${className}`}
      data-testid={`buyout-card-${variant}`}
    >
      <h2
        className={
          dashboard
            ? 'text-sm font-medium text-gray-500 uppercase tracking-wide mb-2'
            : 'font-medium text-gray-900'
        }
      >
        {dashboard ? t('dashboardHeading') : t('cancelHeading')}
      </h2>
      {dashboard && ownership ? (
        <div className="mb-3" data-testid="paid-toward-ownership">
          <p className="text-lg font-bold text-gray-900">{es ? OWNERSHIP_COPY_ES.paidToward(ownership.paidCents) : paidTowardOwnershipLine(ownership.paidCents)}</p>
          {ownership.clearingCents > 0 ? (
            <p className="text-xs text-gray-500" data-testid="ownership-clearing">
              {es ? OWNERSHIP_COPY_ES.stillClearing(ownership.clearingCents) : stillClearingLine(ownership.clearingCents)}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-gray-500" data-testid="ownership-note">
            {es ? OWNERSHIP_COPY_ES.note : OWNERSHIP_NOTE}
          </p>
        </div>
      ) : null}
      <p className={dashboard ? 'text-sm text-gray-600 mb-4' : 'text-sm text-gray-600 mt-1 mb-4'}>
        {dashboard ? t('dashboardBody') : t('cancelBody')}
      </p>
      <BuyoutTiers alreadyRequested={alreadyRequested} onRequest={onRequest} paidCents={ownership?.paidCents ?? null} />
    </section>
  )
}

/** Dashboard spot (below the subscription card): shown for active, ending and offline customers. */
export function DashboardBuyoutCard({
  access,
  alreadyRequested,
  onRequest,
  ownership = null,
}: {
  access: WebsiteAccess | null
  alreadyRequested: boolean
  onRequest: (tierId?: BuyoutTierId) => Promise<BuyoutRequestResult>
  ownership?: OwnershipSummary
}) {
  if (!showBuyoutCard(access)) return null
  return (
    <BuyoutCard
      variant="dashboard"
      className="mb-8"
      alreadyRequested={alreadyRequested}
      onRequest={onRequest}
      ownership={ownership}
    />
  )
}
