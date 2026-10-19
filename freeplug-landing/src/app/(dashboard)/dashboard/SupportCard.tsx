import Link from 'next/link'
import { MessageCircle, Mail, HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function SupportCard() {
  const t = useTranslations()
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
        {t('dashboard.home.needHelp')}
      </h2>
      <div className="space-y-3">
        <a
          href="mailto:support@freeplug-in.dev"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
        >
          <div className="rounded-lg bg-blue-50 p-2">
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 group-hover:text-[#ba3d3d]">
              {t('dashboard.home.emailSupport')}
            </p>
            <p className="text-xs text-gray-500">support@freeplug-in.dev</p>
          </div>
        </a>

        <Link
          href="/dashboard/help"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
        >
          <div className="rounded-lg bg-purple-50 p-2">
            <HelpCircle className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 group-hover:text-[#ba3d3d]">
              {t('dashboard.home.helpCenter')}
            </p>
            <p className="text-xs text-gray-500">{t('dashboard.home.faqsGuides')}</p>
          </div>
        </Link>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50">
          <div className="rounded-lg bg-green-50 p-2">
            <MessageCircle className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{t('common.support.availabilityLabel')}</p>
            <p className="text-xs text-gray-500">{t('common.support.cardLine', { supportHours: t('common.support.hours') })}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
