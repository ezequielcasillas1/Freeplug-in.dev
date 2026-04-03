import { DollarSign, FileText, CreditCard, Trophy, Clock } from 'lucide-react'
import type { ActivityItem } from './dashboard-actions'

type Props = {
  activities: ActivityItem[]
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const activityConfig = {
  payment: {
    icon: DollarSign,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  request_submitted: {
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  request_updated: {
    icon: FileText,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  subscription_created: {
    icon: CreditCard,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  milestone: {
    icon: Trophy,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
}

export function RecentActivity({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
          Recent Activity
        </h2>
        <div className="flex items-center gap-3 text-gray-500">
          <Clock className="h-5 w-5" />
          <p className="text-sm">No recent activity to display.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
        Recent Activity
      </h2>
      <div className="space-y-4">
        {activities.slice(0, 5).map((activity) => {
          const config = activityConfig[activity.type]
          const Icon = config.icon

          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`rounded-lg ${config.bg} p-2 flex-shrink-0`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {formatRelativeTime(activity.date)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                {activity.amount && (
                  <p className="text-sm font-medium text-green-600 mt-0.5">
                    +{formatCents(activity.amount)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {activities.length > 5 && (
        <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-zinc-100">
          Showing 5 of {activities.length} activities
        </p>
      )}
    </div>
  )
}
