import { Suspense } from 'react'
import { AllMerchListClient } from '@/features/merch/components/AllMerchListClient'
import { listAllMerchItems } from '@/lib/merch/all-merch'

export const dynamic = 'force-static'

export default function AllMerchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <AllMerchListClient items={listAllMerchItems()} />
    </Suspense>
  )
}
