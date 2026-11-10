'use client'

import { BrandWordmarkContactTile } from '@/features/merch/components/BrandWordmarkVariation'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { WORDMARK_VARIATIONS } from '@/lib/merch/preview/wordmark-variations'
import { useTranslations } from 'next-intl'

/** Preview-only specimen grid for Cheke name-variation review (screenshots / contact sheet). */
export function WordmarkVariationsContactSheet() {
  const t = useTranslations('public.merch.wordmarkVariations')
  return (
    <MerchPageChrome>
      <main
        className="min-h-screen bg-white py-10 px-4 sm:px-6"
        data-testid="wordmark-variations-contact-sheet"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('heading')}</h1>
        <p className="text-sm text-gray-600 mb-8 max-w-2xl">
          {t('lead', { count: WORDMARK_VARIATIONS.length })}
        </p>
        <section aria-labelledby="dark-shirt-specimens">
          <h2 id="dark-shirt-specimens" className="text-lg font-semibold mb-4">
            {t('darkGarments')}
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
            {WORDMARK_VARIATIONS.map((v) => (
              <li key={`dark-${v.id}`}>
                <BrandWordmarkContactTile variationId={v.id} variant="dark-shirt" />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="light-shirt-specimens">
          <h2 id="light-shirt-specimens" className="text-lg font-semibold mb-4">
            {t('lightGarments')}
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {WORDMARK_VARIATIONS.map((v) => (
              <li key={`light-${v.id}`}>
                <BrandWordmarkContactTile variationId={v.id} variant="light-shirt" />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </MerchPageChrome>
  )
}
