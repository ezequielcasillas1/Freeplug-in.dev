import { FONT_BUNDLE_PRICE_CENTS, MERCH_FONT_BUNDLE_SLUG } from '@/lib/merch/product'
import { publicUrl } from '@/i18n/seo'

type Props = { name: string; description: string; localePath: string }

export function ProductJsonLd({ name, description, localePath }: Props) {
  const url = publicUrl(localePath)
  const json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: [publicUrl('/images/merch/specimen-fp-cursive.png')],
    brand: { '@type': 'Brand', name: 'Freeplug' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'USD',
      price: (FONT_BUNDLE_PRICE_CENTS / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    sku: MERCH_FONT_BUNDLE_SLUG,
    category: 'Digital download / Fonts',
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}
