'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useTranslations } from 'next-intl'
import type { TrackerStep } from '@/lib/outreach/tracker'

type Props = {
  steps: TrackerStep[]
  /** Live website address (after launch); before launch the button opens the preview screenshots. */
  liveUrl: string | null
  showPreview: boolean
  /** Small grey line under the last step ("Live") while it isn't reached (outreach sites). */
  liveNote?: string | null
}

/**
 * Lina's "Your website" card: a vertical tracker in the RecentActivity style (same on phone and
 * desktop). Done = green check; every step not reached yet = grey outline circle, never red
 * (Lina/Sable 1:04 AM), with the current one in bold.
 */
export function YourWebsiteCard({ steps, liveUrl, showPreview, liveNote = null }: Props) {
  const t = useTranslations('claim')
  return (
    <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm" data-testid="your-website-card">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">{t('yourWebsiteHeading')}</h2>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3" data-state={s.state}>
            {s.state === 'done' ? (
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50">
                <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
              </span>
            ) : (
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                <span className="h-3 w-3 rounded-full border-2 border-zinc-300 bg-white" aria-hidden="true" data-testid="step-open-circle" />
              </span>
            )}
            <span className="flex min-h-6 flex-col justify-center">
              <span
                className={
                  s.state === 'current' ? 'text-sm font-semibold text-gray-900' : s.state === 'done' ? 'text-sm text-gray-900' : 'text-sm text-gray-400'
                }
                aria-current={s.state === 'current' ? 'step' : undefined}
              >
                {s.label}
              </span>
              {liveNote && i === steps.length - 1 && s.state !== 'done' ? (
                <span className="mt-0.5 text-xs text-gray-500" data-testid="live-waiting-note">
                  {liveNote}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      {liveUrl ? (
        <a
          href={liveUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'mt-6 w-full sm:w-auto')}
        >
          {t('viewWebsiteLabel')}
        </a>
      ) : showPreview ? (
        <Link href="/dashboard/website" className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'mt-6 w-full sm:w-auto')}>
          {t('viewPreviewLabel')}
        </Link>
      ) : null}
    </div>
  )
}
