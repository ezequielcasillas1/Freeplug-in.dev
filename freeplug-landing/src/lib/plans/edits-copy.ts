import type { EditsIncluded } from './edit-allowance'
import type { PlanStepId } from './ladder'

/**
 * Edit explanations (Cheke, Oct 18 2026). English is live. FP0.5 has no i18n catalog, so the Spanish
 * strings are kept in EDITS_COPY_ES for when the ES catalog lands (not rendered anywhere yet).
 */
export const MAINTENANCE_OPTION_HREF = '/dashboard/request-website?focus=maintenance'

const EDIT_TIMING_EN = ' We aim to finish within 5 business days. Higher plans are usually faster.'
const EDIT_TIMING_ES = ' Buscamos terminar en un plazo de 5 días hábiles. Los planes superiores suelen ir más rápido.'
const CARRY_OVER_EN = " Unused edits don't carry over."
const CARRY_OVER_ES = ' Las ediciones que no uses no pasan al mes siguiente.'

export const EDITS_COPY_EN = {
  fieldHint: "Edits are small updates to what's already on your site.",
  fieldExamples: 'For example: Update your hours · Swap a photo · Change a price',
  /** Rendered with "one-time maintenance" as a link (see fieldNoteParts). */
  fieldNote:
    "New pages, sections or features aren't edits. We'll send you a one-time maintenance quote ($50–$100) first, and nothing is charged unless you approve it.",
  planListNote: 'New pages or features are quoted as one-time maintenance.',
  helpSmallEditAnswer:
    'Small changes like hours, photos or prices count as edits. If you use all your included edits this month, wait for your next billing period or request one-time maintenance for extra small changes. New pages or features get a one-time maintenance quote first.',
} as const

export const EDITS_COPY_ES = {
  fieldHint: 'Las ediciones son cambios pequeños a lo que ya está en tu sitio.',
  fieldExamples: 'Por ejemplo: Actualizar tu horario · Cambiar una foto · Cambiar un precio',
  fieldNote:
    'Las páginas, secciones o funciones nuevas no cuentan como ediciones. Primero te enviamos una cotización de mantenimiento único ($50–$100), y no se cobra nada a menos que la apruebes.',
  fieldNoteLinkText: 'mantenimiento único',
  planListNote: 'Las páginas o funciones nuevas se cotizan como mantenimiento único.',
  helpSmallEditAnswer:
    'Los cambios pequeños, como tu horario, fotos o precios, cuentan como ediciones. Si usas todas las ediciones incluidas este mes, espera al próximo periodo de facturación o solicita un mantenimiento único para cambios pequeños extra. Las páginas o funciones nuevas reciben primero una cotización de mantenimiento único.',
  planExplanation: {
    starter: `2 ediciones al mes: cambios pequeños como tu horario, una foto o un precio.${CARRY_OVER_ES}${EDIT_TIMING_ES}`,
    priority: `5 ediciones al mes: cambios pequeños como tu horario, una foto o un precio. Tus solicitudes van primero en la fila.${CARRY_OVER_ES}${EDIT_TIMING_ES}`,
    fast_lane: `7 ediciones al mes: cambios pequeños como tu horario, una foto o un precio.${CARRY_OVER_ES}${EDIT_TIMING_ES}`,
    leads: `12 ediciones al mes: cambios pequeños como tu horario, una foto o un precio.${CARRY_OVER_ES}${EDIT_TIMING_ES}`,
    get_found: `15 ediciones al mes: cambios pequeños como tu horario, una foto o un precio.${CARRY_OVER_ES}${EDIT_TIMING_ES}`,
    growth: `20 ediciones al mes: cambios pequeños como tu horario, una foto o un precio.${CARRY_OVER_ES}${EDIT_TIMING_ES}`,
  } as Record<PlanStepId, string>,
} as const

/** Splits the field note around its "one-time maintenance" link text. */
export function fieldNoteParts(locale: 'en' | 'es' = 'en'): { before: string; link: string; after: string } {
  const note = locale === 'es' ? EDITS_COPY_ES.fieldNote : EDITS_COPY_EN.fieldNote
  const link = locale === 'es' ? EDITS_COPY_ES.fieldNoteLinkText : 'one-time maintenance'
  const i = note.indexOf(link)
  return { before: note.slice(0, i), link, after: note.slice(i + link.length) }
}

/** The edit strings in the page's language (Spanish build, Oct 19). */
export const editsCopy = (locale: string) => (locale === 'es' ? EDITS_COPY_ES : EDITS_COPY_EN)

/** The plan card explanation in the page's language. */
export const planEditExplanation = (stepId: PlanStepId, locale: string = 'en'): string | undefined =>
  locale === 'es' ? EDITS_COPY_ES.planExplanation[stepId] : PLAN_EDIT_EXPLANATIONS[stepId]

/** Small gray line under a plan card's edit count. */
export const PLAN_EDIT_EXPLANATIONS: Record<PlanStepId, string> = {
  starter: `2 edits a month: small changes like hours, a photo swap or a price change.${CARRY_OVER_EN}${EDIT_TIMING_EN}`,
  priority: `5 edits a month: small changes like hours, a photo swap or a price change. Your requests go first in line.${CARRY_OVER_EN}${EDIT_TIMING_EN}`,
  fast_lane: `7 edits a month: small changes like hours, a photo swap or a price change.${CARRY_OVER_EN}${EDIT_TIMING_EN}`,
  leads: `12 edits a month: small changes like hours, a photo swap or a price change.${CARRY_OVER_EN}${EDIT_TIMING_EN}`,
  get_found: `15 edits a month: small changes like hours, a photo swap or a price change.${CARRY_OVER_EN}${EDIT_TIMING_EN}`,
  growth: `20 edits a month: small changes like hours, a photo swap or a price change.${CARRY_OVER_EN}${EDIT_TIMING_EN}`,
}

/** Retired: edit packs are not sold to customers. */
export function editPackLine(_stepId: PlanStepId): string | null {
  return null
}

/** Retired: edit packs are not sold to customers. */
export function needMoreEditsLine(_stepId: PlanStepId): string | null {
  return null
}

/** Dashboard "Included" line. */
export function editsIncludedLine(e: EditsIncluded, locale: string = 'en'): string {
  if (locale === 'es')
    return e.unlimited
      ? 'Ediciones ilimitadas'
      : e.remaining === 1
        ? `Ediciones incluidas: te queda 1 de ${e.total} en este periodo de facturación`
        : `Ediciones incluidas: te quedan ${e.remaining} de ${e.total} en este periodo de facturación`
  if (e.unlimited) return 'Unlimited edits'
  return `Edits included: ${e.remaining} of ${e.total} left this billing period`
}
