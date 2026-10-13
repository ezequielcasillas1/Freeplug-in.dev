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
/** The Plans card focus style (AddonsBlock rows, TipSlider buttons): 2px solid #ba3d3d, 2px offset. */
export const REMOVAL_OWED_FOCUS_CLASSES = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba3d3d]'
export const REMOVAL_OWED_PROGRAMMATIC_FOCUS_CLASSES =
  'data-[focus-ring=true]:focus:outline data-[focus-ring=true]:focus:outline-2 data-[focus-ring=true]:focus:outline-offset-2 data-[focus-ring=true]:focus:outline-[#ba3d3d]'

export function RemovalOwedBox({ addons, focus = false }: { addons: readonly AddonId[]; focus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focus || !ref.current) return
    ref.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    // focusVisible: ask the browser to treat it as :focus-visible (Chrome / Firefox / Safari honour it).
    // data-focus-ring: the ring shows on this programmatic focus even where the browser's :focus-visible
    // heuristic would skip it; removed on blur, so later mouse focus looks like the rest of the card.
    ref.current.dataset.focusRing = 'true'
    ref.current.focus({ preventScroll: true, focusVisible: true } as FocusOptions)
  }, [focus])
  if (addons.length === 0) return null
  return (
    <div
      ref={ref}
      id={REMOVAL_OWED_BOX_ID}
      tabIndex={-1}
      role="status"
      data-testid="removal-owed"
      onBlur={(e) => delete e.currentTarget.dataset.focusRing}
      // Lina 10:33: the Plans card focus style (2px solid #ba3d3d, 2px offset), as on the add-on rows and the tip buttons.
      className={`mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${REMOVAL_OWED_FOCUS_CLASSES} ${REMOVAL_OWED_PROGRAMMATIC_FOCUS_CLASSES}`}
    >
      <p>{RESUME_REMOVAL_OWED_STATUS(addonNameList([...addons]))}</p>
    </div>
  )
}
