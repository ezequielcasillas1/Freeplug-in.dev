// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRioImport } from './rio-import'
import { readPrefill, readServiceSources, serviceLabelFromFlags, serviceSourceLine } from './schemas'
import { SERVICE_SOURCE_SITE, SERVICE_SOURCE_SITE_AND_THUMBTACK, SERVICE_SOURCE_THUMBTACK_ONLY } from './copy'

const fixture = (name: string) => readFileSync(path.join(__dirname, '../../../supabase/fixtures', name), 'utf8')

function importFixture(name: string) {
  const r = parseRioImport(fixture(name))
  if (!r.ok) throw new Error(`${name}: ${r.error}`)
  return r.values
}

/** What the admin form stores, turned into what the preview page receives. */
function previewDataFor(values: ReturnType<typeof importFixture>) {
  const storedPrefill = Object.fromEntries(Object.entries(values.prefill).map(([k, v]) => [k, v]))
  const storedSources = values.services.map((s) => ({ name: s.name, source_label: s.source, source_url: s.source_url }))
  return {
    prefill: readPrefill(storedPrefill),
    services: readServiceSources(
      values.services.map((s) => s.name),
      storedSources
    ),
  }
}

describe("Rio's Gracia's Lawn Service file", () => {
  const values = importFixture('gracias-lawn-service.prefill.json')

  it('imports every service in site order with its label', () => {
    expect(values.businessName).toBe("Gracia's Lawn Service")
    expect(values.services.map((s) => [s.name, s.source])).toEqual([
      ['Lawn mowing', SERVICE_SOURCE_SITE_AND_THUMBTACK],
      ['Trimming', SERVICE_SOURCE_SITE_AND_THUMBTACK],
      ['Full-service lawn care', SERVICE_SOURCE_SITE_AND_THUMBTACK],
      ['Leaf clean-up', SERVICE_SOURCE_SITE],
      ['Flower-bed cleanup', SERVICE_SOURCE_SITE],
      ['Bush trimming', SERVICE_SOURCE_SITE],
    ])
  })

  it('(a) empty fields keep no value and no source label', () => {
    for (const k of ['phone', 'address', 'quote_email'] as const) {
      expect(values.prefill[k]).toEqual({ value: '', source: '', source_url: '' })
    }
    const preview = previewDataFor(values)
    expect(preview.prefill.phone).toBeUndefined()
    expect(preview.prefill.address).toBeUndefined()
    expect(preview.prefill.quote_email).toBeUndefined()
  })

  it('(b) hours come through as a normal pre-filled value (the form keeps it editable)', () => {
    expect(values.prefill.hours.value).toBe('Sun–Sat 8:00 am – 6:00 pm')
    expect(values.prefill.hours.source).toBe('Thumbtack profile')
    expect(previewDataFor(values).prefill.hours).toEqual({ value: 'Sun–Sat 8:00 am – 6:00 pm', source: 'Thumbtack profile' })
  })

  it('joins the service_area list into one editable value', () => {
    expect(values.prefill.service_area.value).toBe('San Marcos, TX')
  })

  it('services with no source link get no link', () => {
    for (const name of ['Leaf clean-up', 'Flower-bed cleanup', 'Bush trimming']) {
      expect(values.services.find((s) => s.name === name)?.source_url).toBe('')
    }
  })

  it('never sends source_url to the preview page', () => {
    const preview = previewDataFor(values)
    const json = JSON.stringify(preview)
    expect(json).not.toContain('source_url')
    expect(json).not.toContain('thumbtack.com')
    expect(preview.services.map((s) => Object.keys(s).sort())).toEqual(Array(6).fill(['name', 'source']))
  })
})

describe("Rio's JC Construction file", () => {
  it('(e) imports all 11 services, each labelled "From your Thumbtack profile"', () => {
    const raw = JSON.parse(fixture('jc-construction.prefill.json')) as { services: { name: string }[] }
    const values = importFixture('jc-construction.prefill.json')
    expect(raw.services).toHaveLength(11)
    expect(values.services).toHaveLength(11)
    expect(values.services.map((s) => s.name)).toEqual(raw.services.map((s) => s.name))
    expect(new Set(values.services.map((s) => s.source))).toEqual(new Set([SERVICE_SOURCE_THUMBTACK_ONLY]))
    expect(values.prefill.hours.source).toBe('')
  })
})

describe('sample import', () => {
  it('imports the sample file and keeps other bare sources readable', () => {
    const values = importFixture('outreach-sample.json')
    expect(values.businessName).toBe('Rivera Lawn Care')
    expect(values.contactEmail).toBe('owner@riveralawn.example')
    expect(values.prefill.phone.value).toBe('512-555-0100')
    expect(values.services.map((s) => s.source)).toEqual([
      SERVICE_SOURCE_THUMBTACK_ONLY,
      'From your Google Business Profile',
      'From your Facebook page',
    ])
  })
})

describe('import rules', () => {
  it('refuses unknown keys, bad JSON and bad links', () => {
    expect(parseRioImport('{').ok).toBe(false)
    expect(parseRioImport(JSON.stringify({ business_name: 'X', surprise: 1 })).ok).toBe(false)
    expect(
      parseRioImport(JSON.stringify({ business_name: 'X', services: [{ name: 'A', source_url: 'javascript:alert(1)' }] })).ok
    ).toBe(false)
  })

  it('accepts on_site / on_thumbtack flags when there is no label, and dedupes names', () => {
    const r = parseRioImport(
      JSON.stringify({
        business_name: 'X',
        services: [
          { name: 'A', on_site: true, on_thumbtack: true },
          { name: 'B', on_site: true },
          { name: 'C', on_thumbtack: true },
          { name: 'D' },
          { name: 'a', on_site: true },
        ],
      })
    )
    expect(r.ok && r.values.services.map((s) => [s.name, s.source])).toEqual([
      ['A', SERVICE_SOURCE_SITE_AND_THUMBTACK],
      ['B', SERVICE_SOURCE_SITE],
      ['C', SERVICE_SOURCE_THUMBTACK_ONLY],
      ['D', ''],
    ])
  })

  it('normalizes labels to Sable wording', () => {
    expect(serviceSourceLine('Thumbtack profile')).toBe(SERVICE_SOURCE_THUMBTACK_ONLY)
    expect(serviceSourceLine('thumbtack')).toBe(SERVICE_SOURCE_THUMBTACK_ONLY)
    expect(serviceSourceLine('website')).toBe(SERVICE_SOURCE_SITE)
    expect(serviceSourceLine('on your new website and your thumbtack profile')).toBe(SERVICE_SOURCE_SITE_AND_THUMBTACK)
    expect(serviceSourceLine('')).toBe('')
    expect(serviceSourceLine(null)).toBe('')
    expect(serviceLabelFromFlags(false, false)).toBe('')
  })

  it('readServiceSources drops anything but name and label', () => {
    const out = readServiceSources(['A', 'B'], [{ name: 'A', source_label: 'Thumbtack profile', source_url: 'https://x.test' }])
    expect(out).toEqual([
      { name: 'A', source: SERVICE_SOURCE_THUMBTACK_ONLY },
      { name: 'B', source: '' },
    ])
  })
})
