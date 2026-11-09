'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { CrewneckColor, CrewneckSize, MerchCollectionSlug } from '@/lib/merch/collections/catalog'

type Props = {
  collection: MerchCollectionSlug
  slug: string
  optionKey?: string
  size?: CrewneckSize
  color?: CrewneckColor
  quantity: number
  enabled: boolean
  buyLabel: string
  comingSoonLabel: string
  errorGeneric: string
  className?: string
}

export function MerchCollectionCheckoutButton({
  collection,
  slug,
  optionKey,
  size,
  color,
  quantity,
  enabled,
  buyLabel,
  comingSoonLabel,
  errorGeneric,
  className,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onBuy() {
    if (!enabled || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/merch/product', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          collection,
          slug,
          option_key: optionKey,
          size,
          color,
          quantity,
        }),
      })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) {
        setError(data?.error ?? errorGeneric)
        return
      }
      window.location.href = data.url
    } catch {
      setError(errorGeneric)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onClick={onBuy}
        disabled={!enabled || busy}
        className={cn(
          'min-h-[44px] w-full rounded-xl px-6 py-3 text-base font-semibold transition-colors',
          enabled
            ? 'bg-[#ba3d3d] text-white hover:bg-[#a03535] disabled:opacity-60'
            : 'bg-gray-200 text-gray-600 cursor-not-allowed'
        )}
      >
        {enabled ? (busy ? '…' : buyLabel) : comingSoonLabel}
      </button>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
