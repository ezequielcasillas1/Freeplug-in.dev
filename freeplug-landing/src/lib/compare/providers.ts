export type CompareSectionId = 'rentToOwn' | 'diy' | 'agencies'

export type CompareProvider = {
  id: string
  section: CompareSectionId
  pricingUrl: string
  /** Grippy “No” cites FAQ, not pricing. */
  sourceUrl?: string
}

export const COMPARE_PROVIDERS: CompareProvider[] = [
  { id: 'freeplug', section: 'rentToOwn', pricingUrl: '/#hosting-plans' },
  {
    id: 'rwMedia',
    section: 'rentToOwn',
    pricingUrl: 'https://rwmediapros.com/pricing/',
  },
  {
    id: 'grippyCode',
    section: 'rentToOwn',
    pricingUrl: 'https://grippycode.com/pricing',
    sourceUrl: 'https://grippycode.com/faq',
  },
  {
    id: 'leaseReady',
    section: 'rentToOwn',
    pricingUrl: 'https://leasereadywebsites.com/',
  },
  {
    id: 'payPerMonth',
    section: 'rentToOwn',
    pricingUrl: 'https://paypermonthwebsites.com/plans/',
  },
  { id: 'wix', section: 'diy', pricingUrl: 'https://www.wix.com/plans' },
  {
    id: 'squarespace',
    section: 'diy',
    pricingUrl: 'https://www.squarespace.com/pricing',
  },
  {
    id: 'goDaddy',
    section: 'diy',
    pricingUrl: 'https://www.godaddy.com/websites/website-builder',
  },
  { id: 'durable', section: 'diy', pricingUrl: 'https://durable.co/pricing' },
  {
    id: 'sanMarcos',
    section: 'agencies',
    pricingUrl: 'https://smtxwebdesign.com/',
  },
  {
    id: 'oakHarbor',
    section: 'agencies',
    pricingUrl: 'https://oakharborwebdesigns.com/pricing/',
  },
  {
    id: 'arise',
    section: 'agencies',
    pricingUrl: 'https://arisetechco.com/',
  },
]

export const COMPARE_SECTION_ORDER: CompareSectionId[] = ['rentToOwn', 'diy', 'agencies']
