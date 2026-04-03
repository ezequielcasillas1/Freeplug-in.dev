import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { openBillingPortal } from '../billing-actions'
import { getCancelPageData } from './actions'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Globe,
  Wrench,
  Shield,
  Zap,
  RefreshCw,
} from 'lucide-react'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function CancelPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard/cancel')
  }

  const data = await getCancelPageData()

  if (!data) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cancel Services</h1>
        <p className="text-gray-600">Unable to load your account information. Please try again.</p>
      </div>
    )
  }

  const hasActiveSubscriptions = data.subscriptions.length > 0
  const hasCanceledSubscriptions = data.canceledSubscriptions.length > 0

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Your Plan</h1>
      <p className="text-gray-600 mb-8">
        Review your current services, understand what you get with Freeplug.dev, and manage your
        subscriptions.
      </p>

      {/* Active Subscriptions */}
      {hasActiveSubscriptions && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-green-600" size={20} />
            Your Active Services
          </h2>
          <div className="space-y-4">
            {data.subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.productName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatCents(sub.amount)}/{sub.interval}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    Active
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Next billing date: {formatDate(sub.currentPeriodEnd)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Canceled/Paused Subscriptions */}
      {hasCanceledSubscriptions && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="text-amber-600" size={20} />
            Canceled or Scheduled to Cancel
          </h2>
          <div className="space-y-4">
            {data.canceledSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.productName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatCents(sub.amount)}/{sub.interval}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {sub.status === 'canceled' ? 'Canceled' : 'Canceling'}
                  </span>
                </div>
                {sub.cancelAtPeriodEnd && sub.status !== 'canceled' && (
                  <p className="text-sm text-amber-700 mt-3">
                    Access until: {formatDate(sub.currentPeriodEnd)}
                  </p>
                )}
                {sub.canceledAt && (
                  <p className="text-sm text-gray-500 mt-3">
                    Canceled on: {formatDate(sub.canceledAt)}
                  </p>
                )}
              </div>
            ))}

            {/* Resume CTA */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <RefreshCw className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-semibold text-green-900">Ready to Resume?</h3>
                  <p className="text-sm text-green-800 mt-1">
                    You can restart your hosting plan anytime. Your website progress is saved, and
                    any payments you have made toward your website value are still credited to your
                    account.
                  </p>
                  <Link
                    href="/dashboard/plans"
                    className="mt-3 inline-flex font-semibold text-green-700 hover:text-green-800 hover:underline"
                  >
                    View plans to resume →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* No Subscriptions State */}
      {!hasActiveSubscriptions && !hasCanceledSubscriptions && (
        <section className="mb-10">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
            <CreditCard className="mx-auto text-gray-400 mb-3" size={32} />
            <h3 className="font-semibold text-gray-900 mb-1">No Active Subscriptions</h3>
            <p className="text-sm text-gray-600 mb-4">
              {data.hasStripeCustomer
                ? "You don't have any active hosting or maintenance plans."
                : "Start with a website request, then choose a hosting plan that fits your needs."}
            </p>
            <Link
              href="/dashboard/plans"
              className="inline-flex font-semibold text-[#ba3d3d] hover:underline"
            >
              View available plans →
            </Link>
          </div>
        </section>
      )}

      {/* Benefits Section - Why Keep Your Plan */}
      {hasActiveSubscriptions && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What You Get with Your Plan
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Globe className="text-[#ba3d3d] mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">Professional Website Hosting</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Fast, secure hosting optimized for business websites with 99.9% uptime guarantee.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Shield className="text-[#ba3d3d] mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">SSL & Security</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Free SSL certificate and security monitoring to protect your site and visitors.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Wrench className="text-[#ba3d3d] mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">Ongoing Support</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Direct access to our team for questions, updates, and technical assistance.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Zap className="text-[#ba3d3d] mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">Progress Toward Ownership</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Every payment counts toward your website value. Eventually, you can own it outright.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Warning Section */}
      {hasActiveSubscriptions && (
        <section className="mb-10">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-amber-900">What Happens if You Cancel</h3>
                <ul className="text-sm text-amber-800 mt-2 space-y-1.5 list-disc list-inside">
                  <li>Your website will go offline at the end of your billing period</li>
                  <li>Search engine rankings may be affected if your site is down for extended periods</li>
                  <li>Your customers won&apos;t be able to find you online</li>
                  <li>You&apos;ll lose access to ongoing support and maintenance</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Account Summary */}
      {data.totalPaidCents > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Account Summary</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Total Paid to Date</p>
                <p className="text-2xl font-bold text-gray-900">{formatCents(data.totalPaidCents)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Invoices Recorded</p>
                <p className="text-2xl font-bold text-gray-900">{data.invoiceCount}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4 border-t border-zinc-100 pt-4">
              All payments are credited toward your website value. If you cancel and return later,
              your progress is preserved.
            </p>
          </div>
        </section>
      )}

      {/* Cancel Action */}
      {hasActiveSubscriptions && data.hasStripeCustomer && (
        <section className="mb-10">
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
            <div className="flex items-start gap-3">
              <XCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Cancel Your Subscription</h3>
                <p className="text-sm text-red-800 mt-1 mb-4">
                  If you still want to cancel, you can do so through the Stripe billing portal.
                  Your access continues until the end of your current billing period.
                </p>
                <form action={openBillingPortal}>
                  <Button type="submit" variant="destructive" size="sm">
                    Open billing portal to cancel
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Resume / Restart Section */}
      <section className="mb-6">
        <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6">
          <h3 className="font-semibold text-gray-900 mb-2">You Can Always Come Back</h3>
          <p className="text-sm text-gray-600 mb-4">
            Life happens, and we understand. If you cancel now, you are always welcome to return.
            Your account and payment history are preserved, so you can pick up right where you
            left off — no penalty, no hassle.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/plans"
              className="inline-flex rounded-lg bg-[#ba3d3d] text-white px-4 py-2 text-sm font-semibold hover:opacity-95"
            >
              View Plans
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex rounded-lg border border-zinc-300 bg-white text-gray-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section>
        <p className="text-sm text-gray-500 text-center">
          Have questions before making a decision?{' '}
          <a
            href="mailto:support@freeplug.dev"
            className="text-[#ba3d3d] hover:underline font-medium"
          >
            Contact us
          </a>{' '}
          — we&apos;re happy to help.
        </p>
      </section>
    </div>
  )
}
