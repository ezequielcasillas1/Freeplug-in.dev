import { MerchCheckoutButton } from './MerchCheckoutButton'
import { isMerchCheckoutEnabled } from '@/lib/merch/flags'

type Copy = {
  buyCta: string
  comingSoon: string
  emailOptional: string
  emailPlaceholder: string
  checkoutError: string
  mockNotice?: string
}

export function MerchCheckoutBlock({ copy }: { copy: Copy }) {
  const checkoutEnabled = isMerchCheckoutEnabled()
  const effective = checkoutEnabled

  return (
    <MerchCheckoutButton
      checkoutEnabled={effective}
      label={effective ? copy.buyCta : copy.comingSoon}
      emailOptional={copy.emailOptional}
      emailPlaceholder={copy.emailPlaceholder}
      errorGeneric={copy.checkoutError}
      mockNotice={copy.mockNotice}
    />
  )
}
