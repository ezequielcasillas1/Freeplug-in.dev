/**
 * Compare table data (Cheke, Oct 31, 2026). Prices from each company's public site as of Oct 31, 2026.
 * Cell text lives in messages (public.compare.rows.<id>.<cell>); a cell missing there renders as
 * "Not stated". Company names stay in English. Do not add values that aren't on the source page.
 */
export type CompareGroup = 'freeplug' | 'rentToOwn' | 'diy' | 'agencies'
export type CompareCell = 'upfront' | 'monthly' | 'counts' | 'own'
export type CompareWork = 'doneForYou' | 'youBuildIt'

export type CompareRow = {
  id: string
  name: string
  /** Public pricing page used as the source (null = no confident source, name left unlinked). */
  source: string | null
  group: CompareGroup
  work: CompareWork
}

export const COMPARE_CELLS: readonly CompareCell[] = ['upfront', 'monthly', 'counts', 'own']

export const COMPARE_ROWS: readonly CompareRow[] = [
  { id: 'freeplug', name: 'Freeplug', source: null, group: 'freeplug', work: 'doneForYou' },
  { id: 'rwMedia', name: 'RW Media', source: 'https://rwmediapros.com/pricing/', group: 'rentToOwn', work: 'doneForYou' },
  { id: 'grippyCode', name: 'Grippy Code', source: 'https://grippycode.com/pricing', group: 'rentToOwn', work: 'doneForYou' },
  { id: 'leaseReady', name: 'LeaseReady Websites', source: 'https://leasereadywebsites.com/', group: 'rentToOwn', work: 'doneForYou' },
  { id: 'payPerMonth', name: 'Pay Per Month Websites', source: 'https://paypermonthwebsites.com/plans/', group: 'rentToOwn', work: 'doneForYou' },
  { id: 'wix', name: 'Wix', source: 'https://www.wix.com/plans', group: 'diy', work: 'youBuildIt' },
  { id: 'squarespace', name: 'Squarespace', source: 'https://www.squarespace.com/pricing', group: 'diy', work: 'youBuildIt' },
  { id: 'godaddy', name: 'GoDaddy Website Builder', source: 'https://www.godaddy.com/websites/website-builder', group: 'diy', work: 'youBuildIt' },
  { id: 'durable', name: 'Durable', source: 'https://durable.co/pricing', group: 'diy', work: 'youBuildIt' },
  { id: 'sanMarcos', name: 'San Marcos WebDesign', source: 'https://smtxwebdesign.com/', group: 'agencies', work: 'doneForYou' },
  { id: 'oakHarbor', name: 'Oak Harbor Web Designs', source: 'https://oakharborwebdesigns.com/pricing/', group: 'agencies', work: 'doneForYou' },
  { id: 'arise', name: 'Arise Tech Co', source: 'https://arisetechco.com/', group: 'agencies', work: 'doneForYou' },
]

export const COMPARE_GROUP_LABEL: Record<Exclude<CompareGroup, 'freeplug'>, string> = {
  rentToOwn: 'groupRentToOwn',
  diy: 'groupDiy',
  agencies: 'groupAgencies',
}

/** Home page short version: Freeplug + the rent-to-own group (Lina). */
export const HOME_COMPARE_GROUPS: readonly CompareGroup[] = ['freeplug', 'rentToOwn']

/** Sitemap lastmod for /compare. */
export const COMPARE_LASTMOD = '2026-10-31'
