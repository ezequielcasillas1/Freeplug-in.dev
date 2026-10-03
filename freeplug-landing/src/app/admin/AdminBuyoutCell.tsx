'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ADMIN_BUYOUT_PRICE,
  ADMIN_BUYOUT_QUOTED,
  ADMIN_BUYOUT_REQUESTED,
  ADMIN_BUYOUT_TYPE_BADGE,
  formatBuyoutPrice,
} from '@/lib/buyout/buyout'
import { adminSetBuyoutPrice } from './actions'

/** "Buyout" type badge on a request row (Sable's admin labels). */
export function AdminBuyoutBadge() {
  return (
    <span
      className="inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800"
      data-request-type="buyout"
    >
      {ADMIN_BUYOUT_TYPE_BADGE}
    </span>
  )
}

/**
 * Buyout status + price for a buyout request. The owner sets the price here (saved to the
 * admin-only buyout_price_cents column); the customer hears about it from the owner (quick
 * email), same as a maintenance quote.
 */
export function AdminBuyoutPriceCell({
  requestId,
  priceCents,
  onSave = adminSetBuyoutPrice,
}: {
  requestId: string
  /** website_requests.buyout_price_cents (null = not quoted yet). Never read from notes. */
  priceCents: number | null
  /** Injectable for the preview harness. */
  onSave?: (id: string, dollars: string) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const router = useRouter()
  const quoted = priceCents != null
  const initial = !quoted
    ? ''
    : priceCents % 100 === 0
      ? String(priceCents / 100)
      : (priceCents / 100).toFixed(2)
  const [dollars, setDollars] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-2 space-y-1 min-w-[140px]">
      <p className="text-xs font-medium text-zinc-700" data-buyout-status>
        {quoted ? `${ADMIN_BUYOUT_QUOTED}: ${formatBuyoutPrice(priceCents)}` : ADMIN_BUYOUT_REQUESTED}
      </p>
      <label className="block text-[11px] text-zinc-500">
        {ADMIN_BUYOUT_PRICE} (USD)
        <input
          type="number"
          min={1}
          step={1}
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          disabled={pending}
          className="mt-0.5 block w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-900 disabled:opacity-50"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            const r = await onSave(requestId, dollars)
            setMsg(r.ok ? { ok: true, text: 'Saved' } : { ok: false, text: r.error })
            if (r.ok) router.refresh()
          })
        }
      >
        Save price
      </button>
      {msg ? (
        <p className={`text-[11px] ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>
      ) : null}
    </div>
  )
}
