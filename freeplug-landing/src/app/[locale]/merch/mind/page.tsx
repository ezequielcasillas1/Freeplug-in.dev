import { Suspense } from 'react'
import { MerchLayerLandingClient } from '@/features/merch/components/MerchLayerLandingClient'
import { listAllMerchItems } from '@/lib/merch/all-merch'

export const dynamic = 'force-static'

export default function MerchMindPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <MerchLayerLandingClient items={listAllMerchItems()} layer="mind" />
    </Suspense>
  )
}
