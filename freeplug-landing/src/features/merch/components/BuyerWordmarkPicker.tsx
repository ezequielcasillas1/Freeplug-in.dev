'use client'

import {
  BUYER_WORDMARK_BRAND_KEYS,
  buyerWordmarkBrandLabel,
  type BuyerWordmarkBrandKey,
} from '@/lib/merch/preview/buyer-wordmark-brand'
import { cn } from '@/lib/utils/cn'

export function BuyerWordmarkPicker({
  value,
  onChange,
  disabled,
  bakedInPrintify,
  labels,
}: {
  value: BuyerWordmarkBrandKey
  onChange: (key: BuyerWordmarkBrandKey) => void
  disabled?: boolean
  bakedInPrintify?: boolean
  labels: {
    heading: string
    bakedNote: string
  }
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-zinc-900">{labels.heading}</legend>
      <div className="flex flex-wrap gap-2">
        {BUYER_WORDMARK_BRAND_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition',
              value === key
                ? 'border-[#ba3d3d] bg-[#ba3d3d]/10 text-zinc-900'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
            )}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {buyerWordmarkBrandLabel(key)}
          </button>
        ))}
      </div>
      {bakedInPrintify ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
          {labels.bakedNote}
        </p>
      ) : null}
    </fieldset>
  )
}
