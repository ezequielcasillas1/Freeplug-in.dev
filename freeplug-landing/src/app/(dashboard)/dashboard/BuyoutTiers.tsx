'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import type { BuyoutRequestResult } from '@/lib/buyout/buyout'
import {
  BUYOUT_TIERS,
  BUYOUT_TIERS_FILES_ONLY,
  BUYOUT_TIERS_HEADING,
  BUYOUT_TIER_PICK_LABEL,
  buyoutDueCents,
  buyoutDueLine,
  formatTierPrice,
  type BuyoutTierId,
} from '@/lib/buyout/tiers'
import { BuyoutRequestButton } from './BuyoutRequestButton'

/**
 * Oct 19 (Cheke): the buyout tiers, shown up front. The customer picks by page count, then requests.
 * Plain list in the card's existing style (no new theme). paidCents = cleared payments (ownership ledger).
 */
/** Spanish approved by Sable Oct 19 (catalog still draft until Cheke signs off). English comes from tiers.ts. */
const ES = {
  labels: { quick: 'Quick: hasta 5 páginas', up_to_7: 'Hasta 7 páginas', up_to_11: 'Hasta 11 páginas', up_to_15: 'De 12 a 15 páginas', unlimited: 'Unlimited: 16 páginas o más' } as Record<BuyoutTierId, string>,
  heading: 'Precios de compra',
  pick: '¿Cuántas páginas tiene tu sitio web?',
  filesOnly: 'La compra incluye solo los archivos de tu sitio web.',
  due: (amount: string) => `Con lo que ya pagaste, te faltan ${amount}.`,
}

export function BuyoutTiers({
  alreadyRequested,
  onRequest,
  paidCents = null,
}: {
  alreadyRequested: boolean
  onRequest: (tierId?: BuyoutTierId) => Promise<BuyoutRequestResult>
  paidCents?: number | null
}) {
  const es = useLocale() === 'es'
  const [picked, setPicked] = useState<BuyoutTierId | undefined>(undefined)
  const tier = BUYOUT_TIERS.find((t) => t.id === picked) ?? null
  return (
    <div data-testid="buyout-tiers">
      <fieldset className="mb-4" disabled={alreadyRequested}>
        <legend className="text-sm font-medium text-gray-900 mb-1">{alreadyRequested ? (es ? ES.heading : BUYOUT_TIERS_HEADING) : es ? ES.pick : BUYOUT_TIER_PICK_LABEL}</legend>
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {BUYOUT_TIERS.map((t) => (
            <li key={t.id}>
              <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-700 cursor-pointer has-[:checked]:bg-zinc-50">
                <span className="flex items-center gap-2">
                  <input type="radio" name="buyout-tier" value={t.id} checked={picked === t.id} onChange={() => setPicked(t.id)} className="accent-[#ba3d3d]" />
                  {es ? ES.labels[t.id] : t.label}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">{formatTierPrice(t.cents)}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">{es ? ES.filesOnly : BUYOUT_TIERS_FILES_ONLY}</p>
        {tier && paidCents != null && paidCents > 0 ? (
          <p className="mt-1 text-xs text-gray-700" data-testid="buyout-due">{es ? ES.due(formatTierPrice(buyoutDueCents(tier.cents, paidCents))) : buyoutDueLine(buyoutDueCents(tier.cents, paidCents))}</p>
        ) : null}
      </fieldset>
      <BuyoutRequestButton alreadyRequested={alreadyRequested} onRequest={onRequest} tierId={picked} />
    </div>
  )
}
