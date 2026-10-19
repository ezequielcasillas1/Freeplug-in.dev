'use client'

import { BuyoutCard } from '@/app/(dashboard)/dashboard/BuyoutCard'

const noop = async () => ({ ok: true as const, alreadyRequested: false })

export function ReviewCards() {
  return (
    <>
      <BuyoutCard variant="dashboard" alreadyRequested={false} onRequest={noop} ownership={{ paidCents: 30000, clearingCents: 0 }} />
      <BuyoutCard variant="cancel" alreadyRequested={false} onRequest={noop} />
    </>
  )
}
