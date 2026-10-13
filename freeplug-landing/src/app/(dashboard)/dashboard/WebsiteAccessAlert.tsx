'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { WebsiteAccessAlert as Alert } from '@/lib/website-access'
import { resumePlan } from './billing-actions'
import { ResumePlanSubmit } from './ResumePlanSubmit'

/**
 * Website access message (ending / offline). Same look as the dashboard warning alert; one button
 * only: "Resume plan" while ending, "Restart hosting" (checkout) while offline.
 */
export function WebsiteAccessAlert({ alert }: { alert: Alert }) {
  const primary = cn(buttonVariants({ size: 'md' }), 'mt-3 w-full sm:w-auto')
  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-8"
      role="status"
      data-testid={`website-access-${alert.status}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-800">
            {alert.before}
            {alert.date ? <strong>{alert.date}</strong> : null}
            {alert.after}
          </p>
          {alert.button.kind === 'resume' ? (
            <form action={resumePlan}>
              <ResumePlanSubmit className={cn(primary, 'disabled:opacity-60 disabled:cursor-wait')}>{alert.button.label}</ResumePlanSubmit>
            </form>
          ) : (
            <Link href={alert.button.href} className={primary}>
              {alert.button.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
