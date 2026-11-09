import { AllMerchListClient } from '@/features/merch/components/AllMerchListClient'
import { listAllMerchItems } from '@/lib/merch/all-merch'

export const dynamic = 'force-static'

export default function AllMerchPage() {
  return <AllMerchListClient items={listAllMerchItems()} />
}
