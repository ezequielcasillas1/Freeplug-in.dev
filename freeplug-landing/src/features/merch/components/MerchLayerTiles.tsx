'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_LAYER_PUBLIC_PATH, MERCH_LAYERS, type MerchLayer } from '@/lib/merch/layers/layers'

const LAYER_BLURB_KEY: Record<MerchLayer, 'everydayBlurb' | 'giveBlurb' | 'mindBlurb'> = {
  everyday: 'everydayBlurb',
  give: 'giveBlurb',
  mind: 'mindBlurb',
}

export function MerchLayerTiles() {
  const t = useTranslations('public.merch.layers')
  const locale = toAppLocale(useLocale())

  return (
    <div className="grid sm:grid-cols-3 gap-4 mb-10" data-testid="merch-layer-tiles">
      {MERCH_LAYERS.map((layer) => (
        <Link
          key={layer}
          href={publicHref(MERCH_LAYER_PUBLIC_PATH[layer], locale)}
          className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 sm:p-6 hover:border-[#ba3d3d]/40 transition-colors min-h-[120px] text-center sm:text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-[#ba3d3d]">{t(`names.${layer}`)}</span>
          <span className="mt-2 text-lg font-bold text-gray-900">{t(`landing.${layer}.title`)}</span>
          <p className="mt-2 text-sm text-gray-600 line-clamp-3">{t(LAYER_BLURB_KEY[layer])}</p>
        </Link>
      ))}
    </div>
  )
}
