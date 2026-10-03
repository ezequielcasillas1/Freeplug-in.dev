'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { openBillingPortal } from '@/app/(dashboard)/dashboard/billing-actions'
import {
  ADDON_TIERS,
  type AddonTierId,
  HOSTING_DEFAULT_CENTS,
  HOSTING_MAX_CENTS,
  HOSTING_MIN_CENTS,
} from '@/lib/stripe/config'

function dollarsToCents(d: number): number {
  return Math.round(d * 100)
}

const LOGIN_THEN_REQUEST = `/login?next=${encodeURIComponent('/dashboard/request-website')}`

type Props = {
  /** When false, section uses neutral background (e.g. dashboard). */
  embedded?: boolean
  /** Default true (dashboard). Landing passes actual session. */
  signedIn?: boolean
  /** Requires a submitted website request; enforced on API too. Default true. */
  allowCheckout?: boolean
  /**
   * Lines describing the customer's live plan(s). When non-empty, checkout is replaced by
   * Manage billing (the API refuses a second plan with 409 too).
   */
  currentPlanLines?: string[]
  /**
   * Choose-plan mode (outreach claim step 3): the button saves the plan through this callback
   * instead of opening Checkout; nothing is charged. Returns an error message or null.
   */
  onChoosePlan?: (plan: { hostingMonthlyCents: number; addonTier: AddonTierId | 'none' }) => Promise<string | null>
  /** Button label in choose-plan mode. */
  chooseLabel?: string
  /** One grey line above the button in choose-plan mode. */
  noteAboveButton?: string
}

export function HostingCheckoutCard({
  embedded = false,
  signedIn = true,
  allowCheckout = true,
  currentPlanLines,
  onChoosePlan,
  chooseLabel,
  noteAboveButton,
}: Props) {
  const [hostingDollars, setHostingDollars] = useState(
    HOSTING_DEFAULT_CENTS / 100
  )
  const [addonTier, setAddonTier] = useState<AddonTierId | 'none'>('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startHostingCheckout() {
    setError(null)
    const hostingMonthlyCents = dollarsToCents(hostingDollars)
    setLoading(true)
    if (onChoosePlan) {
      try {
        const message = await onChoosePlan({ hostingMonthlyCents, addonTier })
        if (message) setError(message)
      } finally {
        setLoading(false)
      }
      return
    }
    try {
      const res = await fetch('/api/checkout/hosting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostingMonthlyCents,
          addonTier,
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('No checkout URL returned. Try again.')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasLivePlan = (currentPlanLines?.length ?? 0) > 0
  const canPay = signedIn && allowCheckout && !hasLivePlan

  const hostingMin = HOSTING_MIN_CENTS / 100
  const hostingMax = HOSTING_MAX_CENTS / 100
  const addonCents =
    ADDON_TIERS.find((t) => t.id === addonTier)?.monthlyCents ?? 0
  const totalDollars = (dollarsToCents(hostingDollars) + addonCents) / 100

  const shell =
    embedded
      ? 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'
      : 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'

  return (
    <div className={shell}>
      <h3 className="text-xl font-semibold text-gray-900 mb-1">Monthly hosting</h3>
      <p className="text-sm text-gray-500 mb-6">
        ${hostingMin}–${hostingMax}/mo · default ${HOSTING_DEFAULT_CENTS / 100}
      </p>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        ${hostingDollars.toFixed(0)}/month
      </label>
      <input
        type="range"
        min={hostingMin}
        max={hostingMax}
        step={1}
        value={hostingDollars}
        onChange={(e) => setHostingDollars(Number(e.target.value))}
        disabled={!canPay}
        className="w-full accent-[#ba3d3d] mb-6 disabled:opacity-50"
      />
      <fieldset className="mb-6" disabled={!canPay}>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          Add-on (optional)
        </legend>
        <div className="space-y-2">
          <label
            className={`flex items-start gap-3 rounded-lg border p-3 ${
              addonTier === 'none' ? 'border-[#ba3d3d]' : 'border-gray-200'
            } ${canPay ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          >
            <input
              type="radio"
              name="addon-tier"
              value="none"
              checked={addonTier === 'none'}
              onChange={() => setAddonTier('none')}
              className="mt-1 text-[#ba3d3d] focus:ring-[#ba3d3d]"
            />
            <span className="text-sm text-gray-700">No add-on</span>
          </label>
          {ADDON_TIERS.map((tier) => (
            <label
              key={tier.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                addonTier === tier.id ? 'border-[#ba3d3d]' : 'border-gray-200'
              } ${canPay ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            >
              <input
                type="radio"
                name="addon-tier"
                value={tier.id}
                checked={addonTier === tier.id}
                onChange={() => setAddonTier(tier.id)}
                className="mt-1 text-[#ba3d3d] focus:ring-[#ba3d3d]"
              />
              <span className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">
                  {tier.name} (+${tier.monthlyCents / 100}/mo)
                </span>
                <span className="block text-gray-500">{tier.includes.join(' · ')}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm text-gray-700">
          Total: ${totalDollars}/month
        </p>
      </fieldset>
      {hasLivePlan ? (
        <>
          <div className="mb-3 text-sm text-gray-700">
            {currentPlanLines!.map((line) => (
              <p key={line}>Current plan: {line}</p>
            ))}
          </div>
          <form action={openBillingPortal}>
            <Button type="submit" className="w-full" size="lg">
              Manage billing
            </Button>
          </form>
        </>
      ) : canPay ? (
        <>
          {onChoosePlan && noteAboveButton ? (
            <p className="mb-3 text-sm text-gray-500">{noteAboveButton}</p>
          ) : null}
          <Button
            className="w-full"
            size="lg"
            onClick={startHostingCheckout}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={22} />
            ) : onChoosePlan ? (
              chooseLabel ?? 'Continue'
            ) : (
              'Continue to payment'
            )}
          </Button>
        </>
      ) : !signedIn ? (
        <Link
          href={LOGIN_THEN_REQUEST}
          className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
        >
          Sign in & request a website
        </Link>
      ) : (
        <Link
          href="/dashboard/request-website"
          className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
        >
          Submit a website request first
        </Link>
      )}
      {!canPay && !hasLivePlan ? (
        <p className="mt-3 text-sm text-gray-600">
          Hosting checkout opens after you submit a website request from your dashboard.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
