/**
 * Business-type (niche) tagging for Envato items. Whole-word matching only (Aria ruling 6).
 * The 20 types match Lina's shortlist JSON keys.
 */
export const NICHES = [
  'restaurant_texmex', 'food_truck', 'medical_clinic', 'dental', 'hvac', 'plumbing_electrical',
  'roofing_remodel', 'landscaping_lawn', 'cleaning', 'auto_repair', 'salon_barber', 'fitness',
  'legal', 'real_estate', 'insurance_tax', 'church', 'child_care', 'pet_care', 'event_venue',
  'other_local',
] as const
export type Niche = (typeof NICHES)[number]

export function isNiche(v: unknown): v is Niche {
  return typeof v === 'string' && (NICHES as readonly string[]).includes(v)
}

export const NICHE_LABEL: Record<Niche, string> = {
  restaurant_texmex: 'Restaurant / Tex-Mex', food_truck: 'Food truck', medical_clinic: 'Medical clinic',
  dental: 'Dental', hvac: 'HVAC', plumbing_electrical: 'Plumbing / electrical', roofing_remodel: 'Roofing / remodel',
  landscaping_lawn: 'Landscaping / lawn', cleaning: 'Cleaning', auto_repair: 'Auto repair',
  salon_barber: 'Salon / barber', fitness: 'Fitness', legal: 'Legal', real_estate: 'Real estate',
  insurance_tax: 'Insurance / tax', church: 'Church', child_care: 'Child care', pet_care: 'Pet care',
  event_venue: 'Event venue', other_local: 'Other local',
}

/** Whole-word phrase lists per niche (except cleaning, which has its own rule below). */
const NICHE_WORDS: Record<Exclude<Niche, 'cleaning' | 'other_local'>, string[]> = {
  restaurant_texmex: ['restaurant', 'mexican', 'tex-mex', 'taco', 'tacos', 'cantina', 'bistro', 'cafe'],
  food_truck: ['food truck', 'street food', 'fast food'],
  medical_clinic: ['medical', 'clinic', 'doctor', 'hospital', 'healthcare'],
  dental: ['dental', 'dentist', 'orthodontist'],
  hvac: ['hvac', 'air conditioning', 'heating', 'cooling'],
  plumbing_electrical: ['plumber', 'plumbing', 'electrician', 'electrical'],
  roofing_remodel: ['roofing', 'roofer', 'remodel', 'remodeling', 'renovation', 'construction'],
  landscaping_lawn: ['landscaping', 'landscape', 'lawn', 'gardening', 'gardener'],
  auto_repair: ['auto repair', 'car repair', 'mechanic', 'car service', 'auto service'],
  salon_barber: ['salon', 'barber', 'barbershop', 'hair salon', 'beauty salon', 'spa'],
  fitness: ['fitness', 'gym', 'yoga', 'crossfit', 'personal trainer'],
  legal: ['lawyer', 'attorney', 'law firm', 'legal'],
  real_estate: ['real estate', 'realtor', 'property', 'realty'],
  insurance_tax: ['insurance', 'tax', 'accounting', 'accountant'],
  church: ['church', 'ministry', 'religious'],
  child_care: ['daycare', 'child care', 'childcare', 'kindergarten', 'preschool', 'nursery'],
  pet_care: ['pet care', 'veterinary', 'vet', 'pet grooming', 'dog grooming', 'pet shop'],
  event_venue: ['event venue', 'wedding venue', 'banquet', 'events', 'quinceanera'],
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function wordRe(words: string[]): RegExp {
  return new RegExp(`(?<![\\w-])(?:${words.map(escapeRe).join('|')})(?![\\w-])`, 'i')
}
const NICHE_RES = Object.fromEntries(
  Object.entries(NICHE_WORDS).map(([k, w]) => [k, wordRe(w)]),
) as Record<keyof typeof NICHE_WORDS, RegExp>

/** Prebuild section 3: never "clean" alone. */
export const CLEANING_RE =
  /\b(carpet cleaning|window cleaning|pressure washing|cleaning|cleaners?|maids?|housekeeping|janitorial)\b/gi
const DESIGN_ONLY_RE = /\bclean(ing)?\s+(design|code|layout|ui|look|style)\b/gi
const HOTEL_RE = /\b(hotels?|hostels?|resorts?|motels?)\b/i

export type CleaningResult =
  | { kind: 'none' }
  | { kind: 'cleaning'; matchedTag: string }
  | { kind: 'flag'; matchedTag: string; why: string }

/** Decide the cleaning tag from the name and tags (not search hits). */
export function classifyCleaning(input: { name: string; tags: string[] }): CleaningResult {
  const fields = [input.name, ...input.tags].map((s) => s.replace(DESIGN_ONLY_RE, ' '))
  const matches = new Set<string>()
  for (const f of fields) for (const m of f.matchAll(CLEANING_RE)) matches.add(m[0].toLowerCase())
  if (matches.size === 0) return { kind: 'none' }
  const first = [...matches][0]
  const onlyHousekeeping = [...matches].every((m) => m === 'housekeeping')
  if (onlyHousekeeping && [input.name, ...input.tags].some((t) => HOTEL_RE.test(t))) {
    return { kind: 'flag', matchedTag: 'housekeeping', why: 'housekeeping + hotel/hostel wording' }
  }
  return { kind: 'cleaning', matchedTag: first }
}

/** auto_niches for an item. Cleaning only on a 'cleaning' result (flags go to Needs Lina). */
export function autoNiches(input: { name: string; tags: string[] }): Niche[] {
  const text = [input.name, ...input.tags]
  const out: Niche[] = []
  for (const [niche, re] of Object.entries(NICHE_RES)) {
    if (text.some((t) => re.test(t))) out.push(niche as Niche)
  }
  if (classifyCleaning(input).kind === 'cleaning') out.push('cleaning')
  return out
}
