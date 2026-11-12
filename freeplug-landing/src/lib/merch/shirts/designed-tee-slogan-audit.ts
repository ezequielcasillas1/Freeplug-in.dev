import { getSupremePreviewSpec, isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

export type DesignedTeeSloganBBoxIssue = {
  slug: string
  code: 'missing-slogan' | 'stacked-overlay' | 'extra-overlay' | 'duplicate-slogan-image'
  detail: string
}

/** Init/world tees must match live PDP: baked JPEG only, no slogan SVG. */
export function auditDesignedTeeSloganDom(slug: string, root: Element): DesignedTeeSloganBBoxIssue[] {
  const issues: DesignedTeeSloganBBoxIssue[] = []
  if (!isSupremeStyleShirtSlug(slug)) return issues

  const sloganSvgs = root.querySelectorAll('[data-testid="designed-tee-slogan-overlay"]')
  if (sloganSvgs.length > 0) {
    issues.push({
      slug,
      code: 'stacked-overlay',
      detail: `slogan SVG overlay must be off on live-parity tees (found ${sloganSvgs.length})`,
    })
  }

  const brandSvgs = root.querySelectorAll(
    '[data-testid="merch-shirt-mockup"] .pointer-events-none svg'
  )
  if (brandSvgs.length > 0) {
    issues.push({
      slug,
      code: 'extra-overlay',
      detail: `unexpected vector overlay (${brandSvgs.length})`,
    })
  }

  const spec = getSupremePreviewSpec(slug)
  if (!spec?.lines?.length) {
    issues.push({ slug, code: 'missing-slogan', detail: 'no supreme spec for slug' })
  }

  const img = root.querySelector('[data-testid="merch-shirt-mockup"] img')
  const src = img?.getAttribute('src') ?? ''
  if (/-blank-front\.jpg/i.test(src)) {
    issues.push({ slug, code: 'stacked-overlay', detail: `expected baked *-front.jpg, got ${src}` })
  }

  return issues
}
