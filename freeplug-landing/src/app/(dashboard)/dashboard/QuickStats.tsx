import { DollarSign, CreditCard, Calendar, Globe } from 'lucide-react'
import type { DashboardStats } from './dashboard-actions'

type Props = {
  stats: DashboardStats
}

const statusConfig = {
  live: { label: 'Live', color: 'text-green-600', bg: 'bg-green-50' },
  pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
  offline: { label: 'Offline', color: 'text-red-600', bg: 'bg-red-50' },
  none: { label: 'Not started', color: 'text-gray-500', bg: 'bg-gray-50' },
}

export function QuickStats({ stats }: Props) {
  const status = statusConfig[stats.websiteStatus]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">Total Paid</p>
            <p className="text-lg font-bold text-gray-900">
              ${(stats.totalPaidCents / 100).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">Active Plans</p>
            <p className="text-lg font-bold text-gray-900">{stats.activeSubscriptionCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">Customer Since</p>
            <p className="text-lg font-bold text-gray-900">
              {stats.daysSinceFirstPayment !== null
                ? stats.daysSinceFirstPayment === 0
                  ? 'Today'
                  : `${stats.daysSinceFirstPayment}d`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg ${status.bg} p-2`}>
            <Globe className={`h-5 w-5 ${status.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">Website</p>
            <p className={`text-lg font-bold ${status.color}`}>{status.label}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
