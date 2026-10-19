import { DollarSign, CreditCard, Calendar, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { formatUsdIn } from '@/i18n/format'
import type { DashboardStats } from './dashboard-actions'
import type { WebsiteCardStatus } from './outreach-dashboard'

type Props = {
  stats: DashboardStats
  /** Outreach customers: the Website card follows the "Your website" tracker (outreach-dashboard.ts). */
  website?: WebsiteCardStatus | null
  /** Outreach after Live when the plan can't be loaded: a dash like "Customer Since", not 0. */
  activePlansDash?: boolean
}

/** Labels are dashboard.home.label.* keys. */
const statusConfig = {
  live: { label: 'live', color: 'text-green-600', bg: 'bg-green-50' },
  pending: { label: 'pending', color: 'text-amber-600', bg: 'bg-amber-50' },
  offline: { label: 'offline', color: 'text-red-600', bg: 'bg-red-50' },
  none: { label: 'notStarted', color: 'text-gray-500', bg: 'bg-gray-50' },
}

export function QuickStats({ stats, website = null, activePlansDash = false }: Props) {
  const t = useTranslations('dashboard.home')
  const locale = toAppLocale(useLocale())
  const base = statusConfig[stats.websiteStatus]
  const status = website
    ? { ...(website.tone === 'live' ? statusConfig.live : statusConfig.pending), label: website.label }
    : { ...base, label: t(`label.${base.label}`) }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{t('totalPaid')}</p>
            <p className="text-lg font-bold text-gray-900">
              {formatUsdIn(locale, stats.totalPaidCents, 0)}
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
            <p className="text-xs text-gray-500 truncate">{t('activePlans')}</p>
            <p className="text-lg font-bold text-gray-900" data-testid="active-plans">
              {activePlansDash ? '—' : stats.activeSubscriptionCount}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{t('customerSince')}</p>
            <p className="text-lg font-bold text-gray-900" data-testid="customer-since">
              {stats.daysSinceFirstPayment !== null
                ? stats.daysSinceFirstPayment === 0
                  ? t('today')
                  : t('daysShort', { days: stats.daysSinceFirstPayment })
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
            <p className="text-xs text-gray-500 truncate">{t('website')}</p>
            <p className={`text-lg font-bold ${status.color}`} data-testid="website-status">{status.label}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
