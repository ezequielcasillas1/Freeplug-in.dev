'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { ShirtMockupFigure } from '@/features/merch/components/ShirtMockupFigure'
import { MerchShirtCheckoutButton } from '@/features/merch/components/MerchShirtCheckoutButton'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import {
  SHIRT_COLORS,
  SHIRT_SIZES,
  formatUsdFromCents,
  getShirtBySlug,
  shirtDefaultSelectedColor,
  shirtMockupPublicPath,
  shirtPriceCents,
  shirtShippingCents,
  type PublicShirtProduct,
  type ShirtColor,
  type ShirtSize,
} from '@/lib/merch/shirts/catalog'
import { MERCH_PAGE_TITLE_SCROLL_MT, MERCH_TSHIRT_MAIN_CLASS } from '@/features/merch/merch-main-layout'
import { cn } from '@/lib/utils/cn'

const SWATCH: Record<ShirtColor, string> = {
  Black: '#1a1a1a',
  Charcoal: '#5c5c5c',
  Natural: '#e8e0d4',
  White: '#ffffff',
}

const COLOR_DESIGN_NOTE_SLUGS = [
  '32-world-watch-out-rockefeller',
  '34-world-let-your-work-beat-fantasies',
  '35-world-straight-after-the-freeplug',
] as const
type ColorDesignNoteSlug = (typeof COLOR_DESIGN_NOTE_SLUGS)[number]

function isColorDesignNoteSlug(slug: string): slug is ColorDesignNoteSlug {
  return (COLOR_DESIGN_NOTE_SLUGS as readonly string[]).includes(slug)
}

export function ShirtProductClient({
  product,
  checkoutEnabled,
}: {
  product: PublicShirtProduct
  checkoutEnabled: boolean
}) {
  const t = useTranslations('public.merch.tshirts')
  const locale = toAppLocale(useLocale())
  const entry = getShirtBySlug(product.slug)!

  const [color, setColor] = useState<ShirtColor>(() => shirtDefaultSelectedColor(product.slug))
  const [size, setSize] = useState<ShirtSize>('M')
  const [quantity, setQuantity] = useState(1)
  const [view, setView] = useState<'front' | 'back'>('front')

  const canToggleBack = product.backPrint
  const mockupSrc = useMemo(() => {
    if (view === 'back' && canToggleBack) return shirtMockupPublicPath(product.slug, color, 'back')
    return shirtMockupPublicPath(product.slug, color, 'front')
  }, [canToggleBack, color, product.slug, view])

  const unitCents = shirtPriceCents(entry, size)
  const shippingCents = shirtShippingCents(quantity)
  const title = t(`products.${product.titleKey}`)
  const colorDesignNote = isColorDesignNoteSlug(product.slug) ? t(`colorDesignNotes.${product.slug}`) : null
  const productDescription = product.slug === 'patience-undefined' ? t('productDescriptions.patience-undefined') : null

  return (
    <MerchPageChrome>
      <main className={MERCH_TSHIRT_MAIN_CLASS}>
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{title}</h1>
              {productDescription ? (
                <p className="text-sm sm:text-base text-gray-600 mt-3 leading-relaxed break-words">{productDescription}</p>
              ) : null}
              <p className="text-xl sm:text-2xl font-semibold text-[#ba3d3d] mt-2" aria-live="polite">
                {formatUsdFromCents(unitCents)}
                {quantity > 1 ? (
                  <span className="text-base sm:text-lg text-gray-600 font-normal block sm:inline sm:ml-1 mt-1 sm:mt-0">
                    {t('lineTotal', { total: formatUsdFromCents(unitCents * quantity) })}
                  </span>
                ) : null}
              </p>
            </motion.header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 min-w-0">
              <motion.div variants={fadeInUp} className="min-w-0 space-y-3 sm:space-y-4 order-1">
                <Suspense fallback={<div className="aspect-[5/6] w-full rounded-2xl border border-gray-200 bg-zinc-50" />}>
                  <ShirtMockupFigure
                    slug={product.slug}
                    src={mockupSrc}
                    alt={t('mockupAlt', { title, color, view })}
                    width={1000}
                    height={1200}
                    shirtColor={color}
                    priority
                    sizes="(max-width: 1024px) 100vw, 480px"
                  />
                </Suspense>
                {canToggleBack ? (
                  <div className="flex w-full min-w-0 gap-2" role="group" aria-label={t('viewToggleAria')}>
                    {(['front', 'back'] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setView(side)}
                        className={cn(
                          'min-h-11 flex-1 w-full min-w-0 rounded-lg border px-3 text-sm sm:text-base font-medium',
                          view === side ? 'border-[#ba3d3d] text-[#ba3d3d] bg-white' : 'border-gray-200 text-gray-600 bg-gray-50'
                        )}
                      >
                        {t(side === 'front' ? 'viewFront' : 'viewBack')}
                      </button>
                    ))}
                  </div>
                ) : null}
              </motion.div>

              <motion.div variants={fadeInUp} className="min-w-0 space-y-5 sm:space-y-6 order-2">
                <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                  <legend className="text-sm font-semibold text-gray-900 mb-2">{t('colorLabel')}</legend>
                  <div className="flex flex-wrap gap-2.5 w-full">
                    {SHIRT_COLORS.map((c) => (
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
                  {colorDesignNote ? (
                    <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">{colorDesignNote}</p>
                  ) : null}
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
                  <label htmlFor="shirt-qty" className="text-sm font-semibold text-gray-900 block mb-2">
                    {t('quantityLabel')}
                  </label>
                  <select
                    id="shirt-qty"
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
                  slug={product.slug}
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
                </section>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
