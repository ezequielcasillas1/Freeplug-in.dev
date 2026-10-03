import type { BuyoutRequestResult } from '@/lib/buyout/buyout'
import type { WebsiteAccess } from '@/lib/website-access'
import {
  showBuyoutCard,
  BUYOUT_CANCEL_BODY,
  BUYOUT_CANCEL_HEADING,
  BUYOUT_DASHBOARD_BODY,
  BUYOUT_DASHBOARD_HEADING,
} from '@/lib/buyout/buyout'
import { BuyoutRequestButton } from './BuyoutRequestButton'

type Props = {
  /** 'dashboard' = "Want to keep your website?" card; 'cancel' = "Keep your website" card. */
  variant: 'dashboard' | 'cancel'
  alreadyRequested: boolean
  onRequest: () => Promise<BuyoutRequestResult>
  className?: string
}

/** Plain card: dashboard card style on the dashboard, benefit-card style on the cancel page. */
export function BuyoutCard({ variant, alreadyRequested, onRequest, className = '' }: Props) {
  const dashboard = variant === 'dashboard'
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
        {dashboard ? BUYOUT_DASHBOARD_HEADING : BUYOUT_CANCEL_HEADING}
      </h2>
      <p className={dashboard ? 'text-sm text-gray-600 mb-4' : 'text-sm text-gray-600 mt-1 mb-4'}>
        {dashboard ? BUYOUT_DASHBOARD_BODY : BUYOUT_CANCEL_BODY}
      </p>
      <BuyoutRequestButton alreadyRequested={alreadyRequested} onRequest={onRequest} />
    </section>
  )
}

/** Dashboard spot (below the subscription card): shown for active, ending and offline customers. */
export function DashboardBuyoutCard({
  access,
  alreadyRequested,
  onRequest,
}: {
  access: WebsiteAccess | null
  alreadyRequested: boolean
  onRequest: () => Promise<BuyoutRequestResult>
}) {
  if (!showBuyoutCard(access)) return null
  return (
    <BuyoutCard
      variant="dashboard"
      className="mb-8"
      alreadyRequested={alreadyRequested}
      onRequest={onRequest}
    />
  )
}
