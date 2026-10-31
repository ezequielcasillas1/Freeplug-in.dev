'use client'

import { buttonVariants } from '@/components/ui/button'
import { PausedCta } from '@/components/cta/PausedCta'
import { CTA_PAUSED_NOW } from '@/lib/cta-pause'
import { cn } from '@/lib/utils/cn'

/** The one CTA under the compare table; "Coming soon" while CTA_PAUSED (lib/cta-pause.ts). */
export function CompareCta({ href, label }: { href: string; label: string }) {
  const btn = cn(buttonVariants({ size: 'lg' }), 'shadow-lg shadow-[#ba3d3d]/30')
  return CTA_PAUSED_NOW ? <PausedCta className={btn} /> : <a href={href} className={btn}>{label}</a>
}
