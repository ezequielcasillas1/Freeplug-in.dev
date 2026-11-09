import { describe, expect, it } from 'vitest'
import floorsJson from './printify-shipping-floors.json'
import { listCatalogProducts, optionShippingClass } from './catalog'
import { MERCH_SHIPPING_TABLE } from './shipping'

const { floors, optionFloors } = floorsJson as {
  floors: Record<string, { first: number; extra: number }>
  optionFloors: Record<string, Record<string, { first: number; extra: number }>>
}

describe('Printify shipping coverage', () => {
  for (const entry of listCatalogProducts()) {
    it(`${entry.slug} rates cover Printify US shipping`, () => {
      const productFloor = floors[entry.slug]
      expect(productFloor, `missing Printify floor for ${entry.slug}`).toBeTruthy()

      const options = entry.slug === 'hero-crewneck' ? [{ key: 'default', shipping_class: entry.shipping_class }] : entry.options
      expect(options.length).toBeGreaterThan(0)

      for (const opt of options) {
        const shipKey = entry.slug === 'hero-crewneck' ? 'default' : opt.key
        const floor = optionFloors[entry.slug]?.[opt.key] ?? productFloor!
        const shippingClass =
          entry.slug === 'hero-crewneck' ? entry.shipping_class : optionShippingClass(entry, opt as (typeof entry.options)[number])
        const row = MERCH_SHIPPING_TABLE[shippingClass]
        expect(row.first_cents).toBeGreaterThanOrEqual(floor.first)
        expect(row.additional_cents).toBeGreaterThanOrEqual(floor.extra)
        void shipKey
      }
    })
  }
})
