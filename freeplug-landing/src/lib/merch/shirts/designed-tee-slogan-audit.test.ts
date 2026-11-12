import { describe, expect, it } from 'vitest'
import { supremeSloganNormalizedBox } from '@/lib/merch/shirts/designed-tee-slogan-audit'

describe('designed tee slogan bbox', () => {
  it('keeps slogan boxes inside normalized mockup frame', () => {
    for (const slug of ['11-init-open-hand-give', '13-init-daily-bread-share', '23-world-know-a-plug']) {
      const box = supremeSloganNormalizedBox(slug)!
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.left + box.width).toBeLessThanOrEqual(1.02)
      expect(box.top + box.height).toBeLessThanOrEqual(1.02)
    }
  })
})
