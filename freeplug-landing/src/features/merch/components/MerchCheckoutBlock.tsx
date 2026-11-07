import { MerchCheckoutButton } from './MerchCheckoutButton'

type Copy = {
  buyCta: string
  comingSoon: string
  emailOptional: string
  emailPlaceholder: string
  checkoutError: string
  mockNotice?: string
}

export function MerchCheckoutBlock({ copy, enabled }: { copy: Copy; enabled: boolean }) {
  const checkoutEnabled = enabled
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
