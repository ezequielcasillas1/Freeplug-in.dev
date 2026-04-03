'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import {
  ADDON_MONTHLY_CENTS,
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
}

export function HostingCheckoutCard({
  embedded = false,
  signedIn = true,
  allowCheckout = true,
}: Props) {
  const [hostingDollars, setHostingDollars] = useState(
    HOSTING_DEFAULT_CENTS / 100
  )
  const [includeAddon, setIncludeAddon] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startHostingCheckout() {
    setError(null)
    const hostingMonthlyCents = dollarsToCents(hostingDollars)
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/hosting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostingMonthlyCents,
          includeAddon,
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

  const canPay = signedIn && allowCheckout

  const hostingMin = HOSTING_MIN_CENTS / 100
  const hostingMax = HOSTING_MAX_CENTS / 100

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
      <label
        className={`flex items-center gap-3 mb-6 ${canPay ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
      >
        <input
          type="checkbox"
          checked={includeAddon}
          onChange={(e) => setIncludeAddon(e.target.checked)}
          disabled={!canPay}
          className="rounded border-gray-300 text-[#ba3d3d] focus:ring-[#ba3d3d]"
        />
        <span className="text-sm text-gray-700">
          Include add-on (+${ADDON_MONTHLY_CENTS / 100}/mo)
        </span>
      </label>
      {canPay ? (
        <Button
          className="w-full"
          size="lg"
          onClick={startHostingCheckout}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" size={22} /> : 'Continue to payment'}
        </Button>
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
      {!canPay ? (
        <p className="mt-3 text-sm text-gray-600">
          Hosting checkout opens after you submit a website request from your dashboard.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
