import { isMerchCheckoutEnabled } from '@/lib/merch/flags'
import { FontBundleProductClient } from './FontBundleProductClient'

// Server wrapper: Worker vars (process.env) are only readable on the server. Reading them inside the
// client component made the button render 'Coming soon' after hydration even with the flag on.
export const dynamic = 'force-dynamic'

export default function FontBundleProductPage() {
  return <FontBundleProductClient checkoutEnabled={isMerchCheckoutEnabled()} />
}
