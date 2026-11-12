import { GirlfriendCollectionProductClient } from '@/features/merch/components/GirlfriendCollectionProductClient'
import { isMerchShirtsEnabled } from '@/lib/merch/flags'
import { getGirlfriendCollectionCatalog } from '@/lib/merch/shirts/girlfriend-collection'

export const dynamic = 'force-dynamic'

export default function GirlfriendCollectionPage() {
  const checkoutEnabled = isMerchShirtsEnabled() && getGirlfriendCollectionCatalog().checkoutEnabled
  return <GirlfriendCollectionProductClient checkoutEnabled={checkoutEnabled} />
}
