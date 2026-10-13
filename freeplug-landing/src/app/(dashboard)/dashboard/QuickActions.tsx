'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { MANAGE_BILLING_LABEL, REQUEST_CHANGE_LABEL, SET_UP_DOMAIN_LABEL, UPLOAD_PHOTOS_LABEL } from '@/lib/outreach/copy'
import { openBillingPortal } from './billing-actions'

const BTN = cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'w-full min-h-[44px]')

/** Grid classes. Four buttons: 2×2 on phone, one row of four on desktop (unchanged). */
export const QUICK_ACTIONS_GRID_4 = 'mb-8 grid grid-cols-2 gap-3 md:grid-cols-4'
/** Three buttons (Lina, round 11): phone 2 + 1 with the third full width; desktop one row of three. */
export const QUICK_ACTIONS_GRID_3 = 'mb-8 grid grid-cols-2 gap-3 md:grid-cols-3'
/** "Set up my domain" when it's the last of three: spans row 2 on phone, one column on desktop. */
export const QUICK_ACTIONS_LAST_OF_3 = 'col-span-2 md:col-span-1'

type Props = {
  canManageBilling: boolean
  /** False (outreach customer without a Stripe customer): no "Manage billing" button at all. */
  showManageBilling?: boolean
}

/** Lina's quick actions: outline buttons, 2×2 on phone and one row of four on desktop. */
export function QuickActions({ canManageBilling, showManageBilling = true }: Props) {
  return (
    <div className={showManageBilling ? QUICK_ACTIONS_GRID_4 : QUICK_ACTIONS_GRID_3} data-testid="quick-actions">
      <Link href="/dashboard/help" className={BTN}>
        {REQUEST_CHANGE_LABEL}
      </Link>
      <Link href="/dashboard/photos" className={BTN}>
        {UPLOAD_PHOTOS_LABEL}
      </Link>
      <Link href="/dashboard/domain" className={showManageBilling ? BTN : cn(BTN, QUICK_ACTIONS_LAST_OF_3)}>
        {SET_UP_DOMAIN_LABEL}
      </Link>
      {!showManageBilling ? null : canManageBilling ? (
        <form action={openBillingPortal}>
          <button type="submit" className={BTN}>
            {MANAGE_BILLING_LABEL}
          </button>
        </form>
      ) : (
        <Link href="/dashboard/plans" className={BTN}>
          {MANAGE_BILLING_LABEL}
        </Link>
      )}
    </div>
  )
}
