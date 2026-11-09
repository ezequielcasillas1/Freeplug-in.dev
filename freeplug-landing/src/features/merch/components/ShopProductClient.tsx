'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { ShopMockupPreview } from '@/features/merch/components/ShopMockupPreview'
import { formatUsdFromCents } from '@/lib/merch/shop/pricing'
import { shopProductImageSrc, shopShippingCents } from '@/lib/merch/shop/catalog'
import type { ShopCatalogItem } from '@/lib/merch/shop/types'
import { logoPathForBlank, classifyBlankColor } from '@/lib/merch/shop/contrast'
import { effectiveDpi, isDpiWarning, parseDataUrlDimensions } from '@/lib/merch/shop/upload-validation'
import { cn } from '@/lib/utils/cn'

export function ShopProductClient({
  item,
  checkoutEnabled,
  hasPrintifyProduct,
  customFeeCents,
}: {
  item: ShopCatalogItem
  checkoutEnabled: boolean
  hasPrintifyProduct: boolean
  customFeeCents: number
}) {
  const t = useTranslations('public.merch.shop')
  const locale = toAppLocale(useLocale())

  const colors = item.colors
  const sizes = item.sizes

  const [color, setColor] = useState(colors[0] ?? '')
  const [size, setSize] = useState(sizes[0] ?? '')
  const [variantId, setVariantId] = useState(item.variants[0]?.id ?? 0)
  const [quantity, setQuantity] = useState(1)
  const [designMode, setDesignMode] = useState<'freeplug' | 'custom'>('freeplug')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [customPreview, setCustomPreview] = useState<string | null>(null)
  const [customPath, setCustomPath] = useState<string | null>(null)
  const [dpiWarning, setDpiWarning] = useState(false)
  const [placement, setPlacement] = useState(item.printArea.position)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const variant = useMemo(
    () => item.variants.find((v) => v.id === variantId) ?? item.variants[0],
    [item.variants, variantId]
  )

  const matchingVariants = useMemo(() => {
    return item.variants.filter((v) => {
      if (colors.length && color && v.color !== color) return false
      if (sizes.length && size && v.size !== size) return false
      return true
    })
  }, [item.variants, color, size, colors.length, sizes.length])

  const unitCents = (variant?.retailCents ?? item.fromRetailCents) + (designMode === 'custom' ? customFeeCents : 0)
  const shippingCents = shopShippingCents(item, quantity, variant?.retailCents ?? item.fromRetailCents)

  const blankKind = classifyBlankColor(variant?.color)
  const logoSrc = designMode === 'freeplug' ? logoPathForBlank(blankKind) : null
  const productSrc = shopProductImageSrc(item)

  async function onFile(file: File | null) {
    if (!file) return
    setUploading(true)
  setCheckoutError(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('slug', item.slug)
      const res = await fetch('/api/merch/shop/upload', { method: 'POST', body: fd })
      const json = (await res.json().catch(() => null)) as { path?: string; previewDataUrl?: string; error?: string } | null
      if (!res.ok || !json?.path) {
        setCheckoutError(json?.error ?? t('checkoutError'))
        return
      }
      setCustomPath(json.path)
      if (json.previewDataUrl) {
        setCustomPreview(json.previewDataUrl)
        const dims = parseDataUrlDimensions(json.previewDataUrl)
        if (dims) {
          const widthIn = item.printArea.width / 300
          const heightIn = item.printArea.height / 300
          const dpi = effectiveDpi(dims.width, dims.height, widthIn, heightIn)
          setDpiWarning(isDpiWarning(dpi))
        }
      }
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
        custom_placement: designMode === 'custom' ? placement : undefined,
        rights_confirmed: designMode === 'custom' ? rightsConfirmed : undefined,
      }),
    })
    const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (!res.ok || !json?.url) {
      setCheckoutError(json?.error ?? t('checkoutError'))
      return
    }
    window.location.href = json.url
  }

  const canBuyFreeplug = designMode === 'freeplug' && hasPrintifyProduct
  const canBuyCustom = designMode === 'custom' && Boolean(customPath) && rightsConfirmed
  const buyDisabled = !checkoutEnabled || (designMode === 'freeplug' ? !canBuyFreeplug : !canBuyCustom)

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-6 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10">
          <ShopMockupPreview
            productSrc={productSrc}
            logoSrc={logoSrc}
            customSrc={designMode === 'custom' ? customPreview : null}
            placement={placement}
            alt={t('mockupAlt', { title: item.title })}
          />

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
              <button type="button" className={pill(designMode === 'freeplug')} onClick={() => setDesignMode('freeplug')}>
                {t('designFreeplug')}
              </button>
              <button
                type="button"
                data-testid="shop-design-custom"
                className={pill(designMode === 'custom')}
                onClick={() => setDesignMode('custom')}
              >
                {t('designCustom')}
              </button>
            </div>

            {colors.length ? (
              <label className="block text-sm text-gray-600 mb-3">
                {t('colorLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value)
                    const match = matchingVariants.find((v) => v.color === e.target.value)
                    if (match) setVariantId(match.id)
                  }}
                >
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {sizes.length ? (
              <label className="block text-sm text-gray-600 mb-3">
                {t('sizeLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={size}
                  onChange={(e) => {
                    setSize(e.target.value)
                    const match = item.variants.find((v) => v.size === e.target.value && (!color || v.color === color))
                    if (match) setVariantId(match.id)
                  }}
                >
                  {sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block text-sm text-gray-600 mb-3">
                {t('variantLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={variantId}
                  onChange={(e) => setVariantId(Number(e.target.value))}
                >
                  {item.variants.slice(0, 40).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title ?? v.id}
                    </option>
                  ))}
                </select>
              </label>
            )}

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
                {dpiWarning ? <p className="text-sm text-amber-700">{t('uploadDpiWarning')}</p> : null}
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
                  value={placement.scale}
                  onChange={(e) => setPlacement((p) => ({ ...p, scale: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
            ) : null}

            <p className="text-sm text-gray-600 mb-2">{t('freeShippingPromo')}</p>
            <p className="text-sm text-gray-600 mb-2">
              {t('shippingLine', { shipping: formatUsdFromCents(shippingCents) })}
            </p>
            <p className="text-xs text-gray-500 mb-4">{t('shippingUsOnly')}</p>
            {customFeeCents > 0 ? (
              <p className="text-xs text-gray-500 mb-4">{t('customFeeNote', { fee: formatUsdFromCents(customFeeCents) })}</p>
            ) : (
              <p className="text-xs text-gray-500 mb-4">{t('customFeeNone')}</p>
            )}

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
