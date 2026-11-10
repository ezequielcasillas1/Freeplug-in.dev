'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { MerchPreviewFigure } from '@/features/merch/components/MerchPreviewFigure'
import { MerchCollectionCheckoutButton } from '@/features/merch/components/MerchCollectionCheckoutButton'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import {
  CREWNECK_COLORS,
  CREWNECK_SIZES,
  collectionLineShippingCents,
  collectionMockupPublicPath,
  crewneckUnitPriceCents,
  formatUsdFromCents,
  getCatalogProduct,
  resolveCatalogOption,
  type CrewneckColor,
  type CrewneckSize,
  type MerchCollectionSlug,
  type PublicCollectionProduct,
} from '@/lib/merch/collections/catalog'
import { defaultSplitSelection, planSplitOptions, resolveSplitOptionKey } from '@/lib/merch/collections/option-groups'
import { qualifiesForFreeCollectionShipping } from '@/lib/merch/collections/shipping'
import { MERCH_PAGE_TITLE_SCROLL_MT, MERCH_TSHIRT_MAIN_CLASS } from '@/features/merch/merch-main-layout'
import { cn } from '@/lib/utils/cn'

const SWATCH: Record<CrewneckColor, string> = {
  Black: '#1a1a1a',
  White: '#ffffff',
  Sand: '#e8e0d4',
}

const CANVAS_MOCKUP: Record<string, string> = {
  '16x20': 'running-over-canvas-16x20.jpg',
  '24x36': 'running-over-canvas-24x36.jpg',
}

export function CollectionProductClient({
  collection,
  product,
  checkoutEnabled,
}: {
  collection: MerchCollectionSlug
  product: PublicCollectionProduct
  checkoutEnabled: boolean
}) {
  const t = useTranslations('public.merch.collections')
  const locale = toAppLocale(useLocale())
  const entry = getCatalogProduct(product.slug)!

  const splitPlan = useMemo(() => (product.isCrewneck ? null : planSplitOptions(entry)), [entry, product.isCrewneck])
  const defaultSplit = splitPlan ? defaultSplitSelection(splitPlan) : null

  const defaultOption = product.isCrewneck ? null : (entry.options[0]?.key ?? null)
  const [optionKey, setOptionKey] = useState<string | null>(defaultOption)
  const [splitDim1, setSplitDim1] = useState(defaultSplit?.dim1 ?? '')
  const [splitDim2, setSplitDim2] = useState(defaultSplit?.dim2 ?? '')
  const [color, setColor] = useState<CrewneckColor>('Black')
  const [size, setSize] = useState<CrewneckSize>('M')
  const [quantity, setQuantity] = useState(1)

  const splitDim2Values = useMemo(() => {
    if (!splitPlan) return []
    return splitPlan.dim2Values.filter((d2) => splitPlan.pairs.has(`${splitDim1}\0${d2}`))
  }, [splitPlan, splitDim1])

  const effectiveSplitDim2 = useMemo(() => {
    if (!splitPlan) return splitDim2
    if (splitDim2Values.includes(splitDim2)) return splitDim2
    return splitDim2Values[0] ?? ''
  }, [splitPlan, splitDim2, splitDim2Values])

  const splitOptionKey = useMemo(() => {
    if (!splitPlan) return null
    return resolveSplitOptionKey(splitPlan, splitDim1, effectiveSplitDim2)
  }, [splitPlan, splitDim1, effectiveSplitDim2])

  const resolvedKey = product.isCrewneck ? `${size} / ${color}` : splitPlan ? splitOptionKey : optionKey
  const option = resolvedKey ? resolveCatalogOption(entry, resolvedKey) : null

  const mockupSrc =
    product.slug === 'running-over-canvas' && resolvedKey
      ? collectionMockupPublicPath(collection, CANVAS_MOCKUP[resolvedKey] ?? 'running-over-canvas-16x20.jpg')
      : product.mockupSrc

  const unitCents = product.isCrewneck ? crewneckUnitPriceCents(size) : (option?.price_cents ?? product.fromPriceCents)
  const shippingCents = option
    ? collectionLineShippingCents({
        collection,
        slug: product.slug,
        title: entry.title,
        optionKey: option.key,
        optionLabel: option.key,
        quantity,
        unitAmountCents: option.price_cents,
        shippingClass: option.shipping_class ?? entry.shipping_class,
        printifyProductId: entry.printify_product_id,
        printifyVariantId: option.printify_variant_id,
      })
    : 0

  const merchandiseSubtotalCents = unitCents * quantity
  const shippingDisplay =
    option && qualifiesForFreeCollectionShipping(merchandiseSubtotalCents)
      ? t('shippingLineFree')
      : option
        ? t('shippingLine', { shipping: formatUsdFromCents(shippingCents) })
        : ''

  const title = t(`products.${product.titleKey}`)
  const descriptionKey = `productDetails.${product.titleKey}` as const

  const splitDim1Legend =
    splitPlan?.dim1Kind === 'style'
      ? t('styleLabel')
      : splitPlan?.dim1Kind === 'color'
        ? t('colorLabel')
        : splitPlan?.dim1Kind === 'size'
          ? t('sizeLabel')
          : t('optionLabel')
  const splitDim2Legend =
    splitPlan?.dim2Kind === 'size' ? t('sizeLabel') : splitPlan?.dim2Kind === 'color' ? t('colorLabel') : t('optionLabel')

  const labelSplitDim1 = (v: string) => {
    if (splitPlan?.dim1Kind === 'style') {
      if (v === 'Artwork') return t('styleArtwork')
      if (v === 'Photo') return t('stylePhoto')
    }
    return splitPlan ? splitPlan.formatDim1(v) : v
  }
  const labelSplitDim2 = (v: string) => (splitPlan ? splitPlan.formatDim2(v) : v)

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
              <Link href={publicHref(`/merch/${collection}`, locale)} className="hover:text-[#ba3d3d] min-h-[44px] inline-flex items-center">
                {t(`collectionTitles.${collection}`)}
              </Link>
            </motion.p>

            <motion.header variants={fadeInUp} className={`${MERCH_PAGE_TITLE_SCROLL_MT} mb-6 lg:mb-8 min-w-0`}>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{title}</h1>
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
              <motion.div variants={fadeInUp} className="min-w-0 order-1">
                <MerchPreviewFigure
                  src={mockupSrc}
                  alt={t('mockupAlt', { title })}
                  width={1000}
                  height={1200}
                  priority
                  sizes="(max-width: 1024px) 100vw, 480px"
                  preview={{
                    source: 'merch-store',
                    slug: product.slug,
                    href: `/merch/${collection}/${product.slug}`,
                    productType: collection,
                    catalogKey: `${collection}/${product.slug}`,
                    garmentColor: product.isCrewneck ? color : null,
                  }}
                />
              </motion.div>

              <motion.div variants={fadeInUp} className="min-w-0 space-y-5 sm:space-y-6 order-2">
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{t(descriptionKey)}</p>

                {!product.isCrewneck && splitPlan ? (
                  <>
                    <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                      <legend className="text-sm font-semibold text-gray-900 mb-2">{splitDim1Legend}</legend>
                      <div className="flex flex-wrap gap-2 w-full">
                        {splitPlan.dim1Values.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              setSplitDim1(v)
                              const d2 = splitPlan.dim2Values.filter((d2) => splitPlan.pairs.has(`${v}\0${d2}`))
                              if (d2[0]) setSplitDim2(d2[0])
                            }}
                            className={cn(
                              'min-h-11 rounded-lg border px-3 text-sm font-medium',
                              splitDim1 === v
                                ? 'border-[#ba3d3d] text-[#ba3d3d] bg-white'
                                : 'border-gray-200 text-gray-600 bg-gray-50'
                            )}
                          >
                            {labelSplitDim1(v)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                      <legend className="text-sm font-semibold text-gray-900 mb-2">{splitDim2Legend}</legend>
                      <div className="flex flex-wrap gap-2 w-full">
                        {splitDim2Values.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setSplitDim2(v)}
                            className={cn(
                              'min-h-11 rounded-lg border px-3 text-sm font-medium',
                              splitDim2 === v
                                ? 'border-[#ba3d3d] text-[#ba3d3d] bg-white'
                                : 'border-gray-200 text-gray-600 bg-gray-50'
                            )}
                          >
                            {labelSplitDim2(v)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </>
                ) : !product.isCrewneck && entry.options.length > 1 ? (
                  <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                    <legend className="text-sm font-semibold text-gray-900 mb-2">{t('optionLabel')}</legend>
                    <div className="flex flex-wrap gap-2 w-full">
                      {entry.options.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setOptionKey(opt.key)}
                          className={cn(
                            'min-h-11 rounded-lg border px-3 text-sm font-medium',
                            optionKey === opt.key
                              ? 'border-[#ba3d3d] text-[#ba3d3d] bg-white'
                              : 'border-gray-200 text-gray-600 bg-gray-50'
                          )}
                        >
                          {opt.label ?? opt.key}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {product.isCrewneck ? (
                  <>
                    <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                      <legend className="text-sm font-semibold text-gray-900 mb-2">{t('colorLabel')}</legend>
                      <div className="flex flex-wrap gap-2.5 w-full">
                        {CREWNECK_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={cn(
                              'min-h-11 rounded-lg border px-3 text-sm font-medium inline-flex items-center gap-2',
                              color === c ? 'border-[#ba3d3d] text-[#ba3d3d]' : 'border-gray-200 text-gray-600'
                            )}
                          >
                            <span
                              className="inline-block h-4 w-4 rounded-full border border-gray-300"
                              style={{ backgroundColor: SWATCH[c] }}
                              aria-hidden
                            />
                            {t(`colors.${c}`)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                      <legend className="text-sm font-semibold text-gray-900 mb-2">{t('sizeLabel')}</legend>
                      <div className="flex flex-wrap gap-2 w-full">
                        {CREWNECK_SIZES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSize(s)}
                            className={cn(
                              'min-h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold',
                              size === s ? 'border-[#ba3d3d] text-[#ba3d3d]' : 'border-gray-200 text-gray-600'
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </>
                ) : null}

                <fieldset className="min-w-0 border-0 p-0 m-0 w-full">
                  <legend className="text-sm font-semibold text-gray-900 mb-2">{t('quantityLabel')}</legend>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-lg border border-gray-200 text-lg font-semibold"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label={t('quantityDecrease')}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-semibold" aria-live="polite">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-lg border border-gray-200 text-lg font-semibold"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      aria-label={t('quantityIncrease')}
                    >
                      +
                    </button>
                  </div>
                </fieldset>

                <MerchCollectionCheckoutButton
                  collection={collection}
                  slug={product.slug}
                  optionKey={product.isCrewneck ? undefined : (optionKey ?? undefined)}
                  size={product.isCrewneck ? size : undefined}
                  color={product.isCrewneck ? color : undefined}
                  quantity={quantity}
                  enabled={checkoutEnabled && Boolean(option)}
                  buyLabel={t('buyCta')}
                  comingSoonLabel={t('comingSoon')}
                  errorGeneric={t('checkoutError')}
                />

                <p className="text-sm text-[#ba3d3d] font-medium">{t('freeShippingPromo')}</p>
                <p className="text-sm text-gray-500">{t('productionInfo')}</p>
                {option ? (
                  <p className="text-sm text-gray-700 font-medium" aria-live="polite">
                    {shippingDisplay}
                  </p>
                ) : null}
                <p className="text-sm text-gray-500">{t('shippingUsOnly')}</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
