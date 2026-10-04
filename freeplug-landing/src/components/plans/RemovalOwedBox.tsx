'use client'

import { useEffect, useRef } from 'react'
import type { AddonId } from '@/lib/plans/ladder'
import { addonNameList, RESUME_REMOVAL_OWED_STATUS } from '@/lib/plans/ladder-copy'
import { REMOVAL_OWED_BOX_ID } from '@/lib/plans/removal-owed-box'

/**
 * Aria 10:09 (option A), Lina's layout: Resume worked, but the add-on removal the cancel dropped
 * couldn't be put back yet, so it is owed (the renewal removes it and refunds its line if billed). The
 * amber pending-switch box style at the top of the Plans card: not a red error, not a toast. It stays
 * while the owed removal is open (the page reads it). A second Resume click lands here with `focus`:
 * scrolled into view and focused.
 */
export function RemovalOwedBox({ addons, focus = false }: { addons: readonly AddonId[]; focus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focus || !ref.current) return
    ref.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    ref.current.focus({ preventScroll: true })
  }, [focus])
  if (addons.length === 0) return null
  return (
    <div
      ref={ref}
      id={REMOVAL_OWED_BOX_ID}
      tabIndex={-1}
      role="status"
      data-testid="removal-owed"
      className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <p>{RESUME_REMOVAL_OWED_STATUS(addonNameList([...addons]))}</p>
    </div>
  )
}
