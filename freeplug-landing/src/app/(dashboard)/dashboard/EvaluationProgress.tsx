import Link from 'next/link'
import type { EvaluationStatus } from '@/types/supabase'
import { evaluationDescription, evaluationTitle } from '@/lib/dashboard/evaluation-copy'
import { Button } from '@/components/ui/button'
import { openBillingPortal } from './billing-actions'
import { AcknowledgeTransferButton } from './AcknowledgeTransferButton'

type Props = {
  status: EvaluationStatus
  progress: number
  targetCents: number | null
  paidCents: number
  milestoneReached: boolean
  stripeCustomerId: string | null
  /** Latest website request is closed in admin — show closure UX instead of profile-only pipeline. */
  intakeClosed?: { businessName: string } | null
  websiteTransferNotes: string | null
  websiteTransferAcknowledgedAt: string | null
}

function WebsiteTransferHandoff({
  milestoneReached,
  notes,
  acknowledgedAt,
}: {
  milestoneReached: boolean
  notes: string | null
  acknowledgedAt: string | null
}) {
  const text = notes?.trim()
  if (!milestoneReached || !text) return null
  const done = acknowledgedAt != null

  return (
    <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
      <p className="text-sm font-semibold text-sky-950">Website keys &amp; transfer</p>
      <p className="mt-1 text-xs text-sky-900/80">
        Your website value milestone is met. Use the details below for DNS, access, or exports. If
        anything is unclear, email us.
      </p>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-md border border-sky-100 bg-white/80 px-3 py-2 text-sm text-gray-900 font-sans">
        {text}
      </pre>
      {done ? (
        <p className="mt-3 text-xs text-sky-900/90">
          You confirmed you reviewed this handoff on{' '}
          <time dateTime={acknowledgedAt!}>
            {new Date(acknowledgedAt!).toLocaleString()}
          </time>
          . Any open website request for your account is marked <strong>closed</strong> so this
          intake is complete on your side.
        </p>
      ) : (
        <AcknowledgeTransferButton />
      )}
    </div>
  )
}

export function EvaluationProgress({
  status,
  progress,
  targetCents,
  paidCents,
  milestoneReached,
  stripeCustomerId,
  intakeClosed,
  websiteTransferNotes,
  websiteTransferAcknowledgedAt,
}: Props) {
  const pct = Math.min(100, Math.max(0, progress))
  const hasTarget = targetCents != null && targetCents > 0
  const showPaidTowardValue = hasTarget && !milestoneReached

  if (intakeClosed) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm mb-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
          Website request
        </h2>
        <p className="text-lg font-semibold text-gray-900 mb-1">Request closed</p>
        <p className="text-sm text-gray-600 mb-4">
          Your request for <span className="font-medium text-gray-800">{intakeClosed.businessName}</span>{' '}
          is marked <strong>closed</strong> on our side. That usually means this intake is finished,
          we are moving to email or another workflow, or the case was declined. If that is unexpected,
          reply to our last message or email us — we are happy to clarify.
        </p>
        <p className="text-sm text-gray-600 mb-4">
          You can start a <strong>new</strong> request anytime if your situation changes. Active
          hosting, billing, or a separate agreement are unchanged unless we told you otherwise — check{' '}
          <strong>Plans</strong> and <strong>Account</strong> below.
        </p>
        <Link
          href="/dashboard/request-website"
          className="inline-flex font-semibold text-[#ba3d3d] hover:underline text-sm"
        >
          Submit a new request →
        </Link>

        {milestoneReached ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">Website value reached</p>
            <p className="mt-1 text-sm text-emerald-900/90">
              Your agreed website value has been met. Hosting and maintenance billing continues on
              your current plans until you cancel in the customer portal or with us.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {stripeCustomerId ? (
                <form action={openBillingPortal}>
                  <Button type="submit" variant="secondary" size="sm">
                    Manage billing
                  </Button>
                </form>
              ) : null}
              <Link
                href="/dashboard/plans"
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-[#ba3d3d] text-white hover:bg-[#a33535] focus:outline-none focus:ring-2 focus:ring-[#ba3d3d] focus:ring-offset-2"
              >
                View plans
              </Link>
            </div>
          </div>
        ) : null}

        <WebsiteTransferHandoff
          milestoneReached={milestoneReached}
          notes={websiteTransferNotes}
          acknowledgedAt={websiteTransferAcknowledgedAt}
        />

        {showPaidTowardValue ? (
          <p className="mt-6 text-sm text-gray-600 border-t border-zinc-100 pt-4">
            Paid toward website value:{' '}
            <span className="font-medium text-gray-900">
              ${(paidCents / 100).toFixed(0)} / ${(targetCents! / 100).toFixed(0)}
            </span>
            .
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm mb-8">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
        Website evaluation
      </h2>
      <p className="text-lg font-semibold text-gray-900 mb-1">
        {evaluationTitle(status)}
      </p>
      <p className="text-sm text-gray-600 mb-4">{evaluationDescription(status)}</p>

      {milestoneReached ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">Website value reached</p>
          <p className="mt-1 text-sm text-emerald-900/90">
            Your agreed website value has been met. Hosting and maintenance billing continues on
            your current plans until you cancel in the customer portal or with us.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {stripeCustomerId ? (
              <form action={openBillingPortal}>
                <Button type="submit" variant="secondary" size="sm">
                  Manage billing
                </Button>
              </form>
            ) : null}
            <Link
              href="/dashboard/plans"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-[#ba3d3d] text-white hover:bg-[#a33535] focus:outline-none focus:ring-2 focus:ring-[#ba3d3d] focus:ring-offset-2"
            >
              View plans
            </Link>
            <a
              href="mailto:support@freeplug-in.dev?subject=Hosting%20transfer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium text-[#ba3d3d] hover:underline px-2"
            >
              Discuss hosting transfer
            </a>
          </div>
        </div>
      ) : null}

      <WebsiteTransferHandoff
        milestoneReached={milestoneReached}
        notes={websiteTransferNotes}
        acknowledgedAt={websiteTransferAcknowledgedAt}
      />

      <div className="mb-2 flex justify-between text-xs text-gray-500">
        <span>Progress</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#ba3d3d] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {showPaidTowardValue ? (
        <p className="mt-4 text-sm text-gray-600">
          Paid toward website value:{' '}
          <span className="font-medium text-gray-900">
            ${(paidCents / 100).toFixed(0)} / ${(targetCents! / 100).toFixed(0)}
          </span>
          . Recurring charges continue after the milestone unless you cancel — see your service
          terms.
        </p>
      ) : null}
    </section>
  )
}
