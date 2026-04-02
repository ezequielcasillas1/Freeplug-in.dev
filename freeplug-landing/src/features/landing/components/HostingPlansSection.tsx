'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'
import {
  HOSTING_DEFAULT_CENTS,
  HOSTING_MAX_CENTS,
  HOSTING_MIN_CENTS,
  MAINTENANCE_MAX_CENTS,
  MAINTENANCE_MIN_CENTS,
} from '@/lib/stripe/config'

function dollarsToCents(d: number): number {
  return Math.round(d * 100)
}

export function HostingPlansSection() {
  const [hostingDollars, setHostingDollars] = useState(
    HOSTING_DEFAULT_CENTS / 100
  )
  const [includeAddon, setIncludeAddon] = useState(false)
  const [maintenanceDollars, setMaintenanceDollars] = useState(
    MAINTENANCE_MIN_CENTS / 100
  )
  const [loading, setLoading] = useState<'hosting' | 'maintenance' | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  async function startHostingCheckout() {
    setError(null)
    const hostingMonthlyCents = dollarsToCents(hostingDollars)
    setLoading('hosting')
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
      setLoading(null)
    }
  }

  async function startMaintenanceCheckout() {
    setError(null)
    const maintenanceCents = dollarsToCents(maintenanceDollars)
    setLoading('maintenance')
    try {
      const res = await fetch('/api/checkout/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceCents }),
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
      setLoading(null)
    }
  }

  const hostingMin = HOSTING_MIN_CENTS / 100
  const hostingMax = HOSTING_MAX_CENTS / 100
  const maintMin = MAINTENANCE_MIN_CENTS / 100
  const maintMax = MAINTENANCE_MAX_CENTS / 100

  return (
    <section
      id="hosting-plans"
      className="py-24 bg-zinc-50 border-y border-zinc-200/80"
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <motion.div variants={fadeInUp} className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-[#ba3d3d] text-sm font-medium mb-2">
            <CreditCard size={16} />
            Stripe checkout
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Hosting & maintenance
          </h2>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
            Choose a monthly hosting amount, optional add-on, or a one-time
            maintenance payment—processed securely with Stripe.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            variants={fadeInUp}
            className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-1">
              Monthly hosting
            </h3>
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
              onChange={(e) =>
                setHostingDollars(Number(e.target.value))
              }
              className="w-full accent-[#ba3d3d] mb-6"
            />
            <label className="flex items-center gap-3 cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={includeAddon}
                onChange={(e) => setIncludeAddon(e.target.checked)}
                className="rounded border-gray-300 text-[#ba3d3d] focus:ring-[#ba3d3d]"
              />
              <span className="text-sm text-gray-700">
                Include add-on (+$5/mo)
              </span>
            </label>
            <Button
              className="w-full"
              size="lg"
              onClick={startHostingCheckout}
              disabled={loading !== null}
            >
              {loading === 'hosting' ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                'Continue to payment'
              )}
            </Button>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-1">
              One-time maintenance
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              ${maintMin}–${maintMax} per request (scope-based)
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ${maintenanceDollars.toFixed(0)}
            </label>
            <input
              type="range"
              min={maintMin}
              max={maintMax}
              step={1}
              value={maintenanceDollars}
              onChange={(e) =>
                setMaintenanceDollars(Number(e.target.value))
              }
              className="w-full accent-[#ba3d3d] mb-6"
            />
            <Button
              variant="secondary"
              className="w-full"
              size="lg"
              onClick={startMaintenanceCheckout}
              disabled={loading !== null}
            >
              {loading === 'maintenance' ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                'Pay maintenance'
              )}
            </Button>
          </motion.div>
        </div>

        {error ? (
          <motion.p
            variants={fadeInUp}
            className="mt-6 text-center text-sm text-red-600"
          >
            {error}
          </motion.p>
        ) : null}
      </motion.div>
    </section>
  )
}
