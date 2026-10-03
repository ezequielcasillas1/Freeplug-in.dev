import type { ReactNode } from 'react'
import { ACCOUNT_ADD_CARD_LINE, ACCOUNT_FIRST_PAYMENT_LINE } from '@/lib/outreach/copy'
import type { AccountBillingLine } from './outreach-dashboard'

type Props = {
  email: string | null | undefined
  line: AccountBillingLine
  /** The Manage billing form (server action), shown when line is 'manage_billing'. */
  manageBilling: ReactNode
}

/**
 * Dashboard Account card (Sable 3:42 AM, Lina). With no line (line 'none') the card is just the
 * email: no bottom margin under it, no empty element after it.
 */
export function AccountCard({ email, line, manageBilling }: Props) {
  const text = line === 'add_card' ? ACCOUNT_ADD_CARD_LINE : line === 'first_payment' ? ACCOUNT_FIRST_PAYMENT_LINE : null
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm" data-testid="account-card">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Account</h2>
      <p className={line === 'none' ? 'text-gray-900' : 'text-gray-900 mb-4'} data-testid="account-email">
        {email}
      </p>
      {line === 'manage_billing' ? manageBilling : null}
      {text ? (
        <p className="text-xs text-gray-500" data-testid="account-billing-line">
          {text}
        </p>
      ) : null}
    </div>
  )
}
