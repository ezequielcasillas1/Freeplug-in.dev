import { describe, expect, it } from 'vitest'
import { SHOWCASE_CATEGORIES, SHOWCASE_TEMPLATES, templatesFor } from '@/lib/templates/public-showcase'

describe('TemplatesShowcaseSection catalog', () => {
  it('recovered live catalog has dozens of templates and six categories', () => {
    expect(SHOWCASE_TEMPLATES.length).toBeGreaterThanOrEqual(70)
    expect(SHOWCASE_CATEGORIES).toHaveLength(6)
  })

  it('includes the live default cleaning row (template-cleaning-6)', () => {
    expect(templatesFor('local', 'cleaning').some((t) => t.template_id === 'cleaning-6')).toBe(true)
  })
})
