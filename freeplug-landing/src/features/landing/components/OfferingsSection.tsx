import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { AUTH_MAINTENANCE } from '@/lib/auth/signups-paused'
import { CALCOM_BOOKING_URL } from '@/lib/booking'
import { HOME_OFFERINGS, HOME_OFFERING_ICONS } from '@/lib/offerings/home-offerings'

// TODO(ask Cheke): the agency line is Sable's placeholder (white-label vs. referral, agency pricing).
// TODO(ask Cheke): SaaS "quote first" follows the maintenance-quote rule; SaaS pricing not confirmed.
// No per-type pricing until Cheke sets it (Lina, Do not).

/** "What we build": right after the hero, before plans (Lina, Oct 22). No animation by design. */
export function OfferingsSection() {
  const t = useTranslations('public.landing.offerings')
  const locale = toAppLocale(useLocale())
  return (
    <section id="what-we-build" aria-labelledby="what-we-build-heading" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <h2 id="what-we-build-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('heading')}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('intro')}</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3" data-testid="offerings-grid">
          {HOME_OFFERINGS.map((type) => {
            const Icon = HOME_OFFERING_ICONS[type]
            return (
              <li key={type} className="flex">
                <Card className="flex w-full flex-col p-4 sm:p-6 border-zinc-200" data-testid={`offering-${type}`}>
                  <div className="flex items-center gap-3 md:flex-col md:items-start">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d]">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{t(`types.${type}.title`)}</h3>
                      {type === 'saas' ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {t('saasTag')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 md:mt-3 flex-1">{t(`types.${type}.line`)}</p>
                  {AUTH_MAINTENANCE ? (
                    // Auth maintenance (Oct 24): /request-website needs a login, so book a call instead.
                    <a
                      href={CALCOM_BOOKING_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 md:mt-4 inline-flex min-h-[32px] md:min-h-[44px] items-center text-sm font-semibold text-[#ba3d3d] hover:underline"
                    >
                      {t('cta')}
                    </a>
                  ) : (
                    <Link
                      href={publicHref('/request-website', locale)}
                      className="mt-1 md:mt-4 inline-flex min-h-[32px] md:min-h-[44px] items-center text-sm font-semibold text-[#ba3d3d] hover:underline"
                    >
                      {t('cta')}
                    </Link>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
