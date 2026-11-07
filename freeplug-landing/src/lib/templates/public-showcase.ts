import catalog from './public-showcase-catalog.json'

export type ShowcaseCategory = (typeof catalog.categories)[number]
export type ShowcaseTemplate = (typeof catalog.templates)[number]

export const SHOWCASE_CATEGORIES: ShowcaseCategory[] = catalog.categories
export const SHOWCASE_TEMPLATES: ShowcaseTemplate[] = catalog.templates

export function categoryLabel(cat: ShowcaseCategory, locale: 'en' | 'es') {
  return locale === 'es' ? cat.label_es : cat.label_en
}

export function nicheLabel(niche: ShowcaseCategory['niches'][number], locale: 'en' | 'es') {
  return locale === 'es' ? niche.label_es : niche.label_en
}

export function templatesFor(categoryId: string, nicheId: string): ShowcaseTemplate[] {
  return SHOWCASE_TEMPLATES.filter((t) => t.category === categoryId && t.niche === nicheId)
}

export function templateBlurb(t: ShowcaseTemplate, locale: 'en' | 'es') {
  return locale === 'es' ? t.good_for_es : t.good_for_en
}
