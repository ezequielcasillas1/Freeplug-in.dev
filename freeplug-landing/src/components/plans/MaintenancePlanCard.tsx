'use client'

import Link from 'next/link'
import {
  maintenanceCtaLabel,
  maintenancePlanBody,
  maintenancePlanSummary,
  maintenancePlanTitle,
} from '@/lib/plans/maintenance-copy'

type Props = {
  /** Dashboard: link to request page with focus. Landing: link to login with next. */
  ctaHref: string
  embedded?: boolean
}

export function MaintenancePlanCard({ ctaHref, embedded = false }: Props) {
  const shell =
    embedded
      ? 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'
      : 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'

  return (
    <div className={shell}>
      <h3 className="text-xl font-semibold text-gray-900 mb-1">{maintenancePlanTitle}</h3>
      <p className="text-sm text-gray-500 mb-4">{maintenancePlanSummary}</p>
      <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 mb-6">
        {maintenancePlanBody.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className="inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-semibold bg-white text-[#ba3d3d] border-2 border-[#ba3d3d] hover:bg-[#ba3d3d] hover:text-white transition-colors"
      >
        {maintenanceCtaLabel}
      </Link>
    </div>
  )
}
