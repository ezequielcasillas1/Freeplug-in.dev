import Link from 'next/link'
import { Info, AlertTriangle, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import type { DashboardAlert } from './dashboard-actions'

type Props = {
  alerts: DashboardAlert[]
}

const alertConfig = {
  info: {
    icon: Info,
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    textColor: 'text-blue-800',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    textColor: 'text-amber-800',
  },
  success: {
    icon: CheckCircle,
    border: 'border-green-200',
    bg: 'bg-green-50',
    iconColor: 'text-green-600',
    titleColor: 'text-green-900',
    textColor: 'text-green-800',
  },
  action: {
    icon: Sparkles,
    border: 'border-[#ba3d3d]/20',
    bg: 'bg-[#ba3d3d]/5',
    iconColor: 'text-[#ba3d3d]',
    titleColor: 'text-gray-900',
    textColor: 'text-gray-700',
  },
}

export function DashboardAlerts({ alerts }: Props) {
  if (alerts.length === 0) return null

  return (
    <div className="space-y-3 mb-8">
      {alerts.map((alert) => {
        const config = alertConfig[alert.type]
        const Icon = config.icon

        return (
          <div
            key={alert.id}
            className={`rounded-xl border ${config.border} ${config.bg} p-4`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`h-5 w-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${config.titleColor}`}>{alert.title}</h3>
                <p className={`text-sm ${config.textColor} mt-0.5`}>{alert.message}</p>
                {alert.actionLabel && alert.actionHref && (
                  <Link
                    href={alert.actionHref}
                    className={`inline-flex items-center gap-1 text-sm font-semibold mt-2 ${config.iconColor} hover:underline`}
                  >
                    {alert.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
