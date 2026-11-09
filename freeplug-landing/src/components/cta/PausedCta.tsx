'use client'

import { useLocale } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { ctaPauseCopy } from '@/lib/cta-pause'
import { cn } from '@/lib/utils/cn'

/** A paused CTA (see lib/cta-pause.ts): not a link, disabled, same classes as the button it replaces. */
export function PausedCta({ className }: { className?: string }) {
  const { button } = ctaPauseCopy(useLocale())
  return (
    <button type="button" disabled aria-disabled="true" data-testid="cta-paused" className={cn(className, 'cursor-not-allowed opacity-70')}>
      {button}
    </button>
  )
}

/** The in-development line, in the hero pill's style. */
export function InDevelopmentLine({ className }: { className?: string }) {
  const { line } = ctaPauseCopy(useLocale())
  return (
    <p data-testid="in-development-line" className={cn('inline-flex items-center gap-2 rounded-full border border-[#ba3d3d]/20 bg-white/60 px-4 py-2 text-xs sm:text-sm font-semibold text-[#ba3d3d]', className)}>
      <Sparkles size={16} className="shrink-0" aria-hidden />
      {line}
    </p>
  )
}
