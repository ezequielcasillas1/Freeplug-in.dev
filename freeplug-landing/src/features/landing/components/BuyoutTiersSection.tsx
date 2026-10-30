import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { BUYOUT_TIERS, formatTierPrice } from '@/lib/buyout/tiers'

/** Short buyout block on the home page (SEO copy, Oct 24). Prices come from the tier config. */
export function BuyoutTiersSection() {
  const t = useTranslations('public.landing.buyoutTiers')
  return (
    <section id="buyout" aria-labelledby="buyout-heading" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4">
            {t('eyebrow')}
          </span>
          <h2 id="buyout-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t.rich('heading', {
              span: (chunks) => (
                <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">{chunks}</span>
              ),
            })}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('intro')}</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 md:gap-6" data-testid="buyout-tiers">
          {BUYOUT_TIERS.map((tier) => (
            <li key={tier.id} className="flex">
              <Card className="flex w-full flex-col items-center p-4 sm:p-6 border-zinc-200 text-center">
                <span className="text-sm font-medium text-gray-600">{t(`tier.${tier.id}`)}</span>
                <span className="mt-2 text-2xl font-bold text-gray-900">{tier.cents == null ? t('customPrice') : formatTierPrice(tier.cents)}</span>
                <span className="text-xs text-gray-500">{tier.cents == null ? t('customScope') : t('oneTime')}</span>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm text-gray-700">{t('customLine')}</p>
        <p className="mt-1 text-center text-sm text-gray-500">{t('note')}</p>
      </div>
    </section>
  )
}
