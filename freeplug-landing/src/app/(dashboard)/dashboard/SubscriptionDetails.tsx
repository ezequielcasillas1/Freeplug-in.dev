import Link from 'next/link'
import { CreditCard, Calendar, ArrowRight } from 'lucide-react'
import type { SubscriptionDetail } from './dashboard-actions'

type Props = {
  subscriptions: SubscriptionDetail[]
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700' },
  trialing: { bg: 'bg-blue-50', text: 'text-blue-700' },
  past_due: { bg: 'bg-red-50', text: 'text-red-700' },
  canceled: { bg: 'bg-gray-100', text: 'text-gray-600' },
  unpaid: { bg: 'bg-amber-50', text: 'text-amber-700' },
  incomplete: { bg: 'bg-amber-50', text: 'text-amber-700' },
  incomplete_expired: { bg: 'bg-gray-100', text: 'text-gray-600' },
  paused: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

export function SubscriptionDetails({ subscriptions }: Props) {
  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  )

  if (activeSubscriptions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gray-50 p-2">
            <CreditCard className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
              Active Subscriptions
            </h2>
            <p className="text-gray-600 mb-4">No active subscriptions.</p>
            <Link
              href="/dashboard/plans"
              className="inline-flex items-center gap-1 font-semibold text-[#ba3d3d] hover:underline text-sm"
            >
              View available plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
        Active Subscriptions
      </h2>
      <div className="space-y-4">
        {activeSubscriptions.map((sub) => {
          const colors = statusColors[sub.status] || statusColors.active

          return (
            <div
              key={sub.id}
              className="flex items-start justify-between border-b border-zinc-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[#ba3d3d]/10 p-2">
                  <CreditCard className="h-5 w-5 text-[#ba3d3d]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{sub.productName}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                    >
                      {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                    {sub.cancelAtPeriodEnd && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700">
                        Canceling
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {formatCents(sub.amount)}/{sub.interval}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="flex items-center gap-1 text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'}: {formatDate(sub.currentPeriodEnd)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-100 flex gap-4">
        <Link
          href="/dashboard/plans"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#ba3d3d] hover:underline"
        >
          Manage plans
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/dashboard/cancel"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel options
        </Link>
      </div>
    </div>
  )
}
