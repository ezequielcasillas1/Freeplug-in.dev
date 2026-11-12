'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { ShopMockupPreview } from '@/features/merch/components/ShopMockupPreview'
import { formatUsdFromCents } from '@/lib/merch/shop/pricing'
import { shopProductImageSrc, shopShippingCents } from '@/lib/merch/shop/shop-product-client-utils'
import { isRemoteShopImage } from '@/lib/merch/shop/shop-listing-image'
import type { ShopCatalogItem } from '@/lib/merch/shop/types'
import {
  pickerMode,
  resolveVariant,
  sizesForColor,
  uniqueColors,
} from '@/lib/merch/shop/variant-options'
import { PRINTIFY_PRINT_AREA_DPI } from '@/lib/merch/shop/print-area'
import { cn } from '@/lib/utils/cn'
import { BuyerWordmarkPicker } from '@/features/merch/components/BuyerWordmarkPicker'
import {
  DEFAULT_BUYER_WORDMARK_BRAND,
  type BuyerWordmarkBrandKey,
} from '@/lib/merch/preview/buyer-wordmark-brand'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import {
  DEFAULT_BUYER_WORDMARK_STYLE,
  type BuyerWordmarkStyleKey,
} from '@/lib/merch/preview/buyer-wordmark-style'
import {
  resolveShopPreviewBlankKind,
  shopDefaultPreviewColor,
  shopGalleryIndexForColor,
} from '@/lib/merch/shop/shop-gallery-blank-kind'
import { useRouter } from 'next/navigation'

export function ShopProductClient({
  item,
  checkoutEnabled,
  hasPrintifyProduct,
  wordmarkBaked = false,
  initialWordmarkBrand = DEFAULT_BUYER_WORDMARK_BRAND,
  initialWordmarkStyle = DEFAULT_BUYER_WORDMARK_STYLE,
  initialColor = null,
}: {
  item: ShopCatalogItem
  checkoutEnabled: boolean
  hasPrintifyProduct: boolean
  wordmarkBaked?: boolean
  initialWordmarkBrand?: BuyerWordmarkBrandKey
  initialWordmarkStyle?: BuyerWordmarkStyleKey
  /** Optional deep-link color (must match item.colors). */
  initialColor?: string | null
}) {
  const t = useTranslations('public.merch.shop')
  const locale = toAppLocale(useLocale())
  const router = useRouter()

  const colorOptions = useMemo(() => uniqueColors(item.variants), [item.variants])
  const mode = useMemo(() => pickerMode(item.variants), [item.variants])
  const defaultColor = useMemo(() => {
    const hero = shopDefaultPreviewColor(item) ?? colorOptions[0] ?? ''
    if (initialColor && colorOptions.includes(initialColor)) return initialColor
    return hero
  }, [colorOptions, initialColor, item])

  const [color, setColor] = useState(defaultColor)
  const [size, setSize] = useState(() => sizesForColor(item.variants, defaultColor || null)[0] ?? '')
  const [titleVariantId, setTitleVariantId] = useState(item.variants[0]?.id ?? 0)
  const [galleryIndex, setGalleryIndex] = useState(() => shopGalleryIndexForColor(item, defaultColor))
  const [quantity, setQuantity] = useState(1)
  const [designMode, setDesignMode] = useState<'freeplug' | 'custom'>('freeplug')
  const [wordmarkBrand, setWordmarkBrand] = useState<BuyerWordmarkBrandKey>(initialWordmarkBrand)
  const [wordmarkStyle, setWordmarkStyle] = useState<BuyerWordmarkStyleKey>(initialWordmarkStyle)
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [customPreview, setCustomPreview] = useState<string | null>(null)
  const [customPath, setCustomPath] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadToken, setUploadToken] = useState<string | null>(null)
  const [customSoldOut, setCustomSoldOut] = useState(false)

  const sizeOptions = useMemo(() => sizesForColor(item.variants, color || null), [item.variants, color])

  const variant = useMemo(() => {
    if (mode === 'title') {
      return resolveVariant(item.variants, { color: null, size: null, variantId: titleVariantId })
    }
    return resolveVariant(item.variants, {
      color: color || null,
      size: mode === 'color-only' ? null : size || null,
      variantId: null,
    })
  }, [item.variants, mode, color, size, titleVariantId])

  const placement = variant?.printArea.position ?? item.printArea.position
  const printArea = variant?.printArea ?? item.printArea
  const [placementScale, setPlacementScale] = useState(placement.scale)
  const customPlacement = { ...placement, scale: placementScale }

  const unitCents = variant?.retailCents ?? item.fromRetailCents
  const shippingCents = shopShippingCents(item, quantity, variant?.retailCents ?? item.fromRetailCents)

  const gallerySlides = useMemo(() => {
    return item.gallery.map((src) => ({ kind: 'blank' as const, src }))
  }, [item.gallery])

  const activeSlide = gallerySlides[galleryIndex] ?? gallerySlides[0]

  const logoSrc = null
  const productSrc =
    designMode === 'custom'
      ? shopProductImageSrc(item, galleryIndex)
      : (activeSlide?.src ?? shopProductImageSrc(item, 0))

  useEffect(() => {
    void fetch('/api/merch/shop/cap')
      .then((r) => r.json())
      .then((j: { soldOut?: boolean }) => setCustomSoldOut(Boolean(j.soldOut)))
      .catch(() => undefined)
  }, [])

  async function onFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setCheckoutError(null)
  setUploadToken(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('slug', item.slug)
      fd.set('variant_id', String(variant?.id ?? item.variants[0]?.id ?? ''))
      const res = await fetch('/api/merch/shop/upload', { method: 'POST', body: fd })
      const json = (await res.json().catch(() => null)) as {
        path?: string
        previewDataUrl?: string
        uploadToken?: string
        error?: string
        code?: string
      } | null
      if (!res.ok || !json?.path) {
        const code = json?.code ?? json?.error
        if (code === 'upload_dpi_low') setCheckoutError(t('uploadDpiBlocked'))
        else if (code === 'upload_moderation_blocked') setCheckoutError(t('uploadModerationBlocked'))
        else setCheckoutError(t('uploadErrorGeneric'))
        return
      }
      setCustomPath(json.path)
      setUploadToken(json.uploadToken ?? null)
      if (json.previewDataUrl) setCustomPreview(json.previewDataUrl)
    } finally {
      setUploading(false)
    }
  }

  async function checkout() {
    setCheckoutError(null)
    if (designMode === 'custom' && !rightsConfirmed) {
      setCheckoutError(t('rightsRequired'))
      return
    }
    const res = await fetch('/api/checkout/merch/shop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: item.slug,
        variant_id: variant?.id,
        quantity,
        design_mode: designMode,
        custom_upload_path: designMode === 'custom' ? customPath : undefined,
        custom_placement: designMode === 'custom' ? customPlacement : undefined,
        rights_confirmed: designMode === 'custom' ? rightsConfirmed : undefined,
        upload_token: designMode === 'custom' ? uploadToken : undefined,
        rights_accepted_locale: locale,
      }),
    })
    const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (!res.ok || !json?.url) {
      setCheckoutError(json?.error ?? t('checkoutError'))
      return
    }
    window.location.assign(json.url)
  }

  const canBuyFreeplug = designMode === 'freeplug' && hasPrintifyProduct
  const canBuyCustom = designMode === 'custom' && Boolean(customPath) && Boolean(uploadToken) && rightsConfirmed && !customSoldOut
  const buyDisabled = !checkoutEnabled || (designMode === 'freeplug' ? !canBuyFreeplug : !canBuyCustom)

  const previewGarmentBlankKind = useMemo(() => {
    if (variant?.blankKind) return variant.blankKind
    return resolveShopPreviewBlankKind({
      item,
      garmentColor: color || null,
      displayImageSrc: productSrc,
      galleryIndex,
    })
  }, [color, galleryIndex, item, productSrc, variant?.blankKind])

  function syncWordmarkQuery(brand: BuyerWordmarkBrandKey, style: BuyerWordmarkStyleKey) {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    params.set('wordmark_brand', brand)
    params.set('wordmark_style', style)
    if (color) params.set('color', color)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const previewWordmark = useMemo(
    () =>
      designMode === 'freeplug'
        ? resolvePreviewWordmark({
            source: 'buyer-shop',
            slug: item.slug,
            href: `/shop/${item.slug}`,
            productType: item.productType,
            catalogKey: `shop/${item.slug}`,
            garmentColor: color || null,
            garmentBlankKind: previewGarmentBlankKind,
            buyerWordmarkBrand: wordmarkBrand,
            buyerWordmarkStyle: wordmarkStyle,
            galleryIndex,
            galleryLength: item.gallery.length,
            shopPrintArea: item.printArea,
          })
        : null,
    [
      color,
      designMode,
      galleryIndex,
      item.gallery.length,
      item.printArea,
      item.productType,
      item.slug,
      previewGarmentBlankKind,
      wordmarkBrand,
      wordmarkStyle,
    ]
  )

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-6 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10">
          <div>
            <ShopMockupPreview
              productSrc={productSrc}
              logoSrc={logoSrc}
              customSrc={designMode === 'custom' ? customPreview : null}
              printArea={printArea}
              placement={designMode === 'custom' ? customPlacement : placement}
              alt={t('mockupAlt', { title: item.title })}
              previewWordmark={previewWordmark}
            />
            {gallerySlides.length > 1 ? (
              <div className="flex gap-2 mt-3 flex-wrap">
                {gallerySlides.map((slide, idx) => (
                  <button
                    key={`${slide.kind}-${slide.src}-${idx}`}
                    type="button"
                    className={cn(
                      'rounded-lg border p-1',
                      galleryIndex === idx ? 'border-[#ba3d3d]' : 'border-gray-200'
                    )}
                    onClick={() => setGalleryIndex(idx)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.src}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 object-contain rounded-md bg-zinc-50"
                      referrerPolicy={isRemoteShopImage(slide.src) ? 'no-referrer' : undefined}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <Link href={publicHref('/shop', locale)} className="text-sm text-[#ba3d3d] hover:underline">
              {t('breadcrumbShop')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 mb-2">{item.title}</h1>
            <p className="text-gray-600 mb-4">
              {item.brand} {item.model}
            </p>
            <p className="text-lg font-semibold text-gray-900 mb-6">
              {t('priceLabel')}: {formatUsdFromCents(unitCents)}
              {quantity > 1 ? ` × ${quantity}` : ''}
            </p>

            <div className="flex gap-2 mb-6">
              <button
                type="button"
                className={pill(designMode === 'freeplug')}
                onClick={() => {
                  setDesignMode('freeplug')
                  setGalleryIndex(shopGalleryIndexForColor(item, color))
                }}
              >
                {t('designFreeplug')}
              </button>
              <button
                type="button"
                data-testid="shop-design-custom"
                className={pill(designMode === 'custom')}
                onClick={() => {
                  setDesignMode('custom')
                  setGalleryIndex(0)
                }}
                disabled={customSoldOut}
                title={customSoldOut ? t('customSoldOutToday') : undefined}
              >
                {customSoldOut ? t('customSoldOutToday') : t('designCustom')}
              </button>
            </div>

            {designMode === 'freeplug' ? (
              <div className="mb-6">
                <BuyerWordmarkPicker
                  value={wordmarkBrand}
                  onChange={(brand) => {
                    setWordmarkBrand(brand)
                    syncWordmarkQuery(brand, wordmarkStyle)
                  }}
                  styleValue={wordmarkStyle}
                  onStyleChange={(style) => {
                    setWordmarkStyle(style)
                    syncWordmarkQuery(wordmarkBrand, style)
                  }}
                  bakedInPrintify={wordmarkBaked}
                  labels={{
                    heading: t('wordmarkHeading'),
                    styleHeading: t('wordmarkStyleHeading'),
                    bakedNote: t('wordmarkBakedNote'),
                  }}
                />
              </div>
            ) : null}

            {mode === 'color-size' || mode === 'color-only' ? (
              <label className="block text-sm text-gray-600 mb-3">
                {t('colorLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={color}
                  onChange={(e) => {
                    const nextColor = e.target.value
                    setColor(nextColor)
                    const nextSizes = sizesForColor(item.variants, nextColor)
                    setSize(nextSizes[0] ?? '')
                    setGalleryIndex(shopGalleryIndexForColor(item, nextColor))
                  }}
                >
                  {colorOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {mode === 'color-size' || mode === 'size-only' ? (
              <label className="block text-sm text-gray-600 mb-3">
                {t('sizeLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                >
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {mode === 'title' ? (
              <label className="block text-sm text-gray-600 mb-3">
                {t('variantLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={titleVariantId}
                  onChange={(e) => setTitleVariantId(Number(e.target.value))}
                >
                  {item.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title ?? `${v.color ?? ''} ${v.size ?? ''}`.trim()}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block text-sm text-gray-600 mb-4">
              {t('quantityLabel')}
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-24 rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>

            {designMode === 'custom' ? (
              <div className="rounded-xl border border-gray-200 p-4 mb-4 space-y-3" data-testid="shop-custom-panel">
                <p className="font-medium text-gray-900">{t('uploadTitle')}</p>
                <p className="text-sm text-gray-600">{t('uploadHint')}</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-xs text-gray-600">
                  <p className="font-semibold text-gray-800 mb-1">{t('contentPolicyTitle')}</p>
                  <p>{t('contentPolicyBody')}</p>
                  <p className="mt-2 text-gray-500">
                    Print area ~
                    {Math.round((printArea.width / PRINTIFY_PRINT_AREA_DPI) * 10) / 10} ×{' '}
                    {Math.round((printArea.height / PRINTIFY_PRINT_AREA_DPI) * 10) / 10} in at 150 DPI min.
                  </p>
                </div>
                <label className="flex gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} />
                  <span>{t('rightsLabel')}</span>
                </label>
                <p className="text-xs text-gray-500">{t('placementTitle')}</p>
                <input
                  type="range"
                  min={0.2}
                  max={0.7}
                  step={0.01}
                  value={placementScale}
                  onChange={(e) => setPlacementScale(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            ) : null}

            <p className="text-sm text-gray-600 mb-2">{t('freeShippingPromo')}</p>
            <p className="text-sm text-gray-600 mb-2">
              {t('shippingLine', { shipping: formatUsdFromCents(shippingCents) })}
            </p>
            <p className="text-xs text-gray-500 mb-4">{t('shippingUsOnly')}</p>
            {checkoutError ? <p className="text-sm text-red-600 mb-3">{checkoutError}</p> : null}

            <button
              type="button"
              disabled={buyDisabled}
              onClick={() => void checkout()}
              className={cn(
                'w-full rounded-xl px-4 py-3 font-semibold transition-colors',
                buyDisabled
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-[#ba3d3d] text-white hover:bg-[#a33434]'
              )}
            >
              {designMode === 'freeplug' && !hasPrintifyProduct ? t('comingSoon') : t('buyCta')}
            </button>
          </div>
        </div>
      </main>
    </MerchPageChrome>
  )
}

function pill(active: boolean) {
  return active
    ? 'rounded-full px-4 py-2 text-sm font-medium bg-[#ba3d3d] text-white'
    : 'rounded-full px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700'
}
