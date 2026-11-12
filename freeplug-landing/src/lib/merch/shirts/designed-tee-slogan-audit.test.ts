import { describe, expect, it } from 'vitest'
import { auditDesignedTeeSloganDom } from '@/lib/merch/shirts/designed-tee-slogan-audit'

describe('designed tee live PDP parity', () => {
  it('rejects stacked slogan SVG on init/world tees', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <figure data-testid="merch-shirt-mockup">
        <img src="/merch/shirts/22-world-fully-charged-black-front.jpg" />
        <svg data-testid="designed-tee-slogan-overlay"></svg>
      </figure>
    `
    const issues = auditDesignedTeeSloganDom('22-world-fully-charged', root)
    expect(issues.some((i) => i.code === 'stacked-overlay')).toBe(true)
  })

  it('accepts baked front only', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <figure data-testid="merch-shirt-mockup">
        <img src="/merch/shirts/20-init-fp-shield-care-black-front.jpg" />
      </figure>
    `
    const issues = auditDesignedTeeSloganDom('20-init-fp-shield-care', root)
    expect(issues).toEqual([])
  })
})
