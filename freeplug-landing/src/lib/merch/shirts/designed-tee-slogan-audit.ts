import { getSupremePreviewSpec, isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

export type DesignedTeeSloganBBoxIssue = {
  slug: string
  code: 'missing-slogan' | 'out-of-bounds' | 'clipped-text' | 'extra-overlay'
  detail: string
}

/** Normalized slogan box (0–1) used by DesignedTeeSloganOverlay. */
export function supremeSloganNormalizedBox(slug: string): { left: number; top: number; width: number; height: number } | null {
  const spec = getSupremePreviewSpec(slug)
  if (!spec?.lines?.length) return null
  const p = spec.placement
  const visual = spec.style === 'boxed'
  const lineCount = spec.lines.length
  const relH = (lineCount >= 3 ? 0.12 : lineCount === 2 ? 0.1 : 0.08) * (visual ? 1.15 : 1)
  const centerX = p.left + p.width / 2
  return {
    left: Math.max(0, centerX - p.width / 2 - (visual ? 0.03 : 0)),
    top: Math.max(0, p.top - relH / 2),
    width: Math.min(1, p.width + (visual ? 0.06 : 0)),
    height: Math.min(1, relH),
  }
}

export function auditDesignedTeeSloganDom(slug: string, root: Element): DesignedTeeSloganBBoxIssue[] {
  const issues: DesignedTeeSloganBBoxIssue[] = []
  if (!isSupremeStyleShirtSlug(slug)) return issues

  const sloganSvgs = root.querySelectorAll('[data-testid="designed-tee-slogan-overlay"]')
  const brandSvgs = root.querySelectorAll('[data-testid="merch-shirt-mockup"] .pointer-events-none svg:not([data-testid="designed-tee-slogan-overlay"])')
  if (sloganSvgs.length !== 1) {
    issues.push({
      slug,
      code: 'extra-overlay',
      detail: `expected 1 slogan overlay, found ${sloganSvgs.length}`,
    })
  }
  if (brandSvgs.length > 0) {
    issues.push({
      slug,
      code: 'extra-overlay',
      detail: `unexpected catalog wordmark overlay (${brandSvgs.length})`,
    })
  }

  const expected = supremeSloganNormalizedBox(slug)
  if (!expected) {
    issues.push({ slug, code: 'missing-slogan', detail: 'no slogan spec' })
    return issues
  }

  const fig = root.querySelector('[data-testid="merch-shirt-mockup"]')
  const figBox = fig?.getBoundingClientRect()
  const svg = sloganSvgs[0] as SVGSVGElement | undefined
  if (!svg || !figBox) return issues

  const bbox = svg.getBBox()
  const margin = 2
  if (bbox.x < -margin || bbox.y < -margin || bbox.x + bbox.width > 100 + margin || bbox.y + bbox.height > 100 + margin) {
    issues.push({
      slug,
      code: 'out-of-bounds',
      detail: `svg bbox ${bbox.x.toFixed(1)},${bbox.y.toFixed(1)} ${bbox.width.toFixed(1)}x${bbox.height.toFixed(1)}`,
    })
  }

  const text = (svg.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (/\.dev|\.in\b/i.test(text)) {
    issues.push({ slug, code: 'clipped-text', detail: `brand wordmark leaked "${text}"` })
  }
  if (text.length > 0 && text.length < 4) {
    issues.push({ slug, code: 'clipped-text', detail: `too short "${text}"` })
  }
  if (text.length && !specLineMatches(slug, text)) {
    issues.push({ slug, code: 'clipped-text', detail: `text does not match spec "${text}"` })
  }

  return issues
}

function specLineMatches(slug: string, rendered: string): boolean {
  const spec = getSupremePreviewSpec(slug)
  if (!spec) return true
  const blob = rendered.replace(/\s+/g, ' ').trim().toUpperCase()
  return spec.lines.some((line) => blob.includes(line.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 6)))
}
