import raw from './template-tree.data.json'

/** Envato Elements template tree (Lina, Oct 23). TEST-ONLY homepage section; demos are link-only. */
export type TemplateNiche = { id: string; label_en: string; label_es: string }
export type TemplateCategory = { id: string; label_en: string; label_es: string; niches: TemplateNiche[] }
export type EnvatoTemplate = {
  template_id: string
  name: string
  category: string
  niche: string
  edition: string
  author: string
  preview_image: string
  live_demo_url: string
  good_for_en: string
  good_for_es: string
}

const data = raw as { categories: TemplateCategory[]; templates: EnvatoTemplate[] }

export const ENVATO_TEMPLATES: EnvatoTemplate[] = data.templates

export function templatesFor(categoryId: string, nicheId: string, all = ENVATO_TEMPLATES): EnvatoTemplate[] {
  return all.filter((t) => t.category === categoryId && t.niche === nicheId)
}

/** Categories with only niches that have at least one template; empty categories are dropped too. */
export function visibleTemplateTree(
  categories: TemplateCategory[] = data.categories,
  all: EnvatoTemplate[] = ENVATO_TEMPLATES,
): TemplateCategory[] {
  return categories
    .map((c) => ({ ...c, niches: c.niches.filter((n) => templatesFor(c.id, n.id, all).length > 0) }))
    .filter((c) => c.niches.length > 0)
}
