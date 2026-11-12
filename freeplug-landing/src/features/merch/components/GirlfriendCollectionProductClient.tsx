'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { MerchShirtCheckoutButton } from '@/features/merch/components/MerchShirtCheckoutButton'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import {
  formatUsdFromCents,
  shirtShippingCents,
  type ShirtColor,
  type ShirtSize,
} from '@/lib/merch/shirts/catalog'
import {
  GIRLFRIEND_COLLECTION_SLUG,
  GIRLFRIEND_DESIGN_IDS,
  girlfriendCollectionColorsForGarment,
  girlfriendCollectionDefaultColor,
  girlfriendCollectionMockupPublicPath,
  girlfriendCollectionUnitPriceCents,
  SHIRT_SIZES,
  type GirlfriendDesignId,
  type GirlfriendGarmentInk,
} from '@/lib/merch/shirts/girlfriend-collection'
import { MERCH_PAGE_TITLE_SCROLL_MT, MERCH_TSHIRT_MAIN_CLASS } from '@/features/merch/merch-main-layout'
import { cn } from '@/lib/utils/cn'

const SWATCH: Record<ShirtColor, string> = {
  Black: '#1a1a1a',
  Charcoal: '#5c5c5c',
  Natural: '#e8e0d4',
  White: '#ffffff',
}

export function GirlfriendCollectionProductClient({ checkoutEnabled }: { checkoutEnabled: boolean }) {
  const t = useTranslations('public.merch.tshirts')
  const tGc = useTranslations('public.merch.tshirts.girlfriendCollection')
  const locale = toAppLocale(useLocale())

  const [designId, setDesignId] = useState<GirlfriendDesignId>('01-no-time')
  const [garment, setGarment] = useState<GirlfriendGarmentInk>('dark')
  const [color, setColor] = useState<ShirtColor>(() => girlfriendCollectionDefaultColor('dark'))
  const [size, setSize] = useState<ShirtSize>('M')
  const [quantity, setQuantity] = useState(1)

  const allowedColors = useMemo(() => girlfriendCollectionColorsForGarment(garment), [garment])

  useEffect(() => {
    if (!allowedColors.includes(color)) {
      setColor(girlfriendCollectionDefaultColor(garment))
    }
  }, [allowedColors, color, garment])

  const mockupSrc = girlfriendCollectionMockupPublicPath(designId, garment)
  const title = tGc(`designs.${designId}.title`)
  const tagline = tGc(`designs.${designId}.text`)
  const unitCents = girlfriendCollectionUnitPriceCents(size)
  const shippingCents = shirtShippingCents(quantity)

  return (
    <MerchPageChrome>
      <main className={MERCH_TSHIRT_MAIN_CLASS} data-testid="girlfriend-collection-pdp">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="min-w-0">
            <motion.p variants={fadeInUp} className="text-sm text-gray-500 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={publicHref('/merch', locale)} className="hover:text-[#ba3d3d] min-h-[44px] inline-flex items-center">
                {t('breadcrumbMerch')}
              </Link>
              <span aria-hidden>/</span>
              <Link href={publicHref('/merch/t-shirts', locale)} className="hover:text-[#ba3d3d] min-h-[44px] inline-flex items-center">
                {t('heading')}
              </Link>
            </motion.p>

            <motion.header variants={fadeInUp} className={`${MERCH_PAGE_TITLE_SCROLL_MT} mb-6 lg:mb-8 min-w-0`}>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{tGc('pageTitle')}</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-3 leading-relaxed break-words">{tGc('pageLead')}</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 mt-4 break-words" aria-live="polite">
                {title}
              </p>
              <p className="text-sm sm:text-base text-gray-600 mt-1 leading-relaxed break-words">{tagline}</p>
              <p className="text-xl sm:text-2xl font-semibold text-[#ba3d3d] mt-3" aria-live="polite">
                {formatUsdFromCents(unitCents)}
                {quantity > 1 ? (
                  <span className="text-base sm:text-lg text-gray-600 font-normal block sm:inline sm:ml-1 mt-1 sm:mt-0">
                    {t('lineTotal', { total: formatUsdFromCents(unitCents * quantity) })}
                  </span>
                ) : null}
              </p>
            </motion.header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 min-w-0">
              <motion.div variants={fadeInUp} className="min-w-0 order-1">
                <div className="relative aspect-[5/6] w-full overflow-hidden rounded-2xl border border-gray-200 bg-zinc-50">
                  <Image
                    src={mockupSrc}
                    alt={tGc('mockupAlt', { title, garment: tGc(`garment.${garment}`) })}
                    width={1200}
                    height={1440}
                    className="h-full w-full object-contain"
                    sizes="(max-width: 1024px) 100vw, 480px"
                    priority
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="min-w-0 space-y-5 sm:space-y-6 order-2">
                <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                  <legend className="text-sm font-semibold text-gray-900 mb-2">{tGc('designLabel')}</legend>
                  <div className="flex flex-wrap gap-2 w-full" role="list">
                    {GIRLFRIEND_DESIGN_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="listitem"
                        aria-pressed={designId === id}
                        onClick={() => setDesignId(id)}
                        className={cn(
                          'min-h-11 rounded-lg border px-3 text-left text-sm font-medium break-words',
                          designId === id
                            ? 'border-[#ba3d3d] text-[#ba3d3d] bg-white'
                            : 'border-gray-200 text-gray-700 bg-gray-50'
                        )}
                      >
                        {tGc(`designs.${id}.title`)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                  <legend className="text-sm font-semibold text-gray-900 mb-2">{tGc('garmentLabel')}</legend>
                  <div className="flex w-full min-w-0 gap-2" role="group" aria-label={tGc('garmentLabel')}>
                    {(['light', 'dark'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGarment(g)}
                        aria-pressed={garment === g}
                        className={cn(
                          'min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium',
                          garment === g ? 'border-[#ba3d3d] text-[#ba3d3d] bg-white' : 'border-gray-200 text-gray-600 bg-gray-50'
                        )}
                      >
                        {tGc(`garment.${g}`)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">{tGc(`garmentHint.${garment}`)}</p>
                </fieldset>

                <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                  <legend className="text-sm font-semibold text-gray-900 mb-2">{t('colorLabel')}</legend>
                  <div className="flex flex-wrap gap-2.5 w-full">
                    {allowedColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={color === c}
                        onClick={() => setColor(c)}
                        className={cn(
                          'min-h-11 min-w-11 rounded-full border-2 p-1 shrink-0',
                          color === c ? 'border-[#ba3d3d]' : 'border-transparent'
                        )}
                        title={t(`colors.${c}`)}
                      >
                        <span
                          className="block h-9 w-9 rounded-full border border-gray-300"
                          style={{ backgroundColor: SWATCH[c] }}
                        />
                        <span className="sr-only">{t(`colors.${c}`)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                  <legend className="text-sm font-semibold text-gray-900 mb-2">{t('sizeLabel')}</legend>
                  <div className="flex flex-wrap gap-2 w-full">
                    {SHIRT_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={size === s}
                        onClick={() => setSize(s)}
                        className={cn(
                          'min-h-11 min-w-11 flex-1 basis-[calc(33.33%-0.5rem)] max-w-[4.5rem] sm:max-w-none sm:flex-none rounded-lg border px-2 sm:px-3 text-sm font-semibold',
                          size === s ? 'border-[#ba3d3d] text-[#ba3d3d] bg-white' : 'border-gray-200 text-gray-700 bg-gray-50'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">{t('sizeNote')}</p>
                </fieldset>

                <div className="w-full min-w-0">
                  <label htmlFor="girlfriend-shirt-qty" className="text-sm font-semibold text-gray-900 block mb-2">
                    {t('quantityLabel')}
                  </label>
                  <select
                    id="girlfriend-shirt-qty"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                    className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <MerchShirtCheckoutButton
                  slug={GIRLFRIEND_COLLECTION_SLUG}
                  designId={designId}
                  color={color}
                  size={size}
                  quantity={quantity}
                  enabled={checkoutEnabled}
                  buyLabel={t('buyCta')}
                  comingSoonLabel={t('comingSoon')}
                  errorGeneric={t('checkoutError')}
                  className="w-full"
                />

                <section className="text-sm sm:text-base text-gray-600 space-y-2 border-t border-gray-200 pt-4 break-words">
                  <p>{t('productionInfo')}</p>
                  <p>{t('shippingInfo', { shipping: formatUsdFromCents(shippingCents) })}</p>
                  <p>{t('shippingUsOnly')}</p>
                  <p>{t('priceFrontOnly')}</p>
                </section>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
