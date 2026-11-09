import { formatAmount } from '@/lib/format/keep-together'
import { EDIT_PACK_CENTS, editPackFor, type EditsIncluded } from './edit-allowance'
import type { PlanStepId } from './ladder'

/**
 * Edit explanations (Cheke, Oct 18 2026). English is live. FP0.5 has no i18n catalog, so the Spanish
 * strings are kept in EDITS_COPY_ES for when the ES catalog lands (not rendered anywhere yet).
 */
export const MAINTENANCE_OPTION_HREF = '/dashboard/request-website?focus=maintenance'

export const EDITS_COPY_EN = {
  fieldHint: "Edits are small updates to what's already on your site.",
  fieldExamples: 'For example: Update your hours · Swap a photo · Change a price',
  /** Rendered with "one-time maintenance" as a link (see fieldNoteParts). */
  fieldNote:
    "New pages, sections or features aren't edits. We'll send you a one-time maintenance quote ($50–$100) first, and nothing is charged unless you approve it.",
  planListNote: 'New pages or features are quoted as one-time maintenance.',
  helpSmallEditAnswer:
    'Small changes like hours, photos or prices count as edits. If you run out, you can add the $5 edit pack. New pages or features get a one-time maintenance quote first.',
} as const

export const EDITS_COPY_ES = {
  fieldHint: 'Las ediciones son cambios pequeños a lo que ya está en tu sitio.',
  fieldExamples: 'Por ejemplo: Actualizar tu horario · Cambiar una foto · Cambiar un precio',
  fieldNote:
    'Las páginas, secciones o funciones nuevas no cuentan como ediciones. Primero te enviamos una cotización de mantenimiento único ($50–$100), y no se cobra nada a menos que la apruebes.',
  fieldNoteLinkText: 'mantenimiento único',
  planListNote: 'Las páginas o funciones nuevas se cotizan como mantenimiento único.',
  helpSmallEditAnswer:
    'Los cambios pequeños, como tu horario, fotos o precios, cuentan como ediciones. Si se te acaban, puedes agregar el paquete de ediciones de $5. Las páginas o funciones nuevas reciben primero una cotización de mantenimiento único.',
  planExplanation: {
    starter: '2 ediciones al mes: cambios pequeños como tu horario, una foto o un precio.',
    priority: '5 ediciones al mes: cambios pequeños como tu horario, una foto o un precio. Tus solicitudes van primero en la fila.',
    fast_lane: '10 ediciones al mes: cambios pequeños como tu horario, una foto o un precio.',
  } as Partial<Record<PlanStepId, string>>,
  editPackLine: (n: number) =>
    `Paquete de ediciones: +${n} ediciones pequeñas por $5 al mes. Un paquete al mes. Las ediciones que no uses no pasan al mes siguiente.`,
  needMoreEdits: (n: number) => `¿Necesitas más ediciones este mes? Agrega el paquete de ediciones de $5 y obtén ${n} más.`,
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

/** Small gray line under a plan card's edit count ($35 / $55 / $65 only, as approved). */
export const PLAN_EDIT_EXPLANATIONS: Partial<Record<PlanStepId, string>> = {
  starter: '2 edits a month: small changes like hours, a photo swap or a price change.',
  priority: '5 edits a month: small changes like hours, a photo swap or a price change. Your requests go first in line.',
  fast_lane: '10 edits a month: small changes like hours, a photo swap or a price change.',
}

/** Edit pack line on a plan card; null on plans without a pack. */
export function editPackLine(stepId: PlanStepId, locale: string = 'en'): string | null {
  const n = editPackFor(stepId)
  if (locale === 'es') return n > 0 ? EDITS_COPY_ES.editPackLine(n) : null
  return n > 0 ? `Edit pack: +${n} small edits for ${formatAmount(EDIT_PACK_CENTS)}/mo. One pack a month. Unused edits don't carry over.` : null
}

/** Replaces the old Starter "+1 small edit" add-on line. */
export function needMoreEditsLine(stepId: PlanStepId, locale: string = 'en'): string | null {
  const n = editPackFor(stepId)
  if (locale === 'es') return n > 0 ? EDITS_COPY_ES.needMoreEdits(n) : null
  return n > 0 ? `Need more edits this month? Add the ${formatAmount(EDIT_PACK_CENTS)} edit pack for ${n} more.` : null
}

/** Dashboard "Included" line. */
export function editsIncludedLine(e: EditsIncluded, locale: string = 'en'): string {
  // DRAFT es (box-translated Oct 19, for Sable): the two dashboard "Included" lines.
  if (locale === 'es') return e.unlimited ? 'Ediciones ilimitadas' : e.remaining === 1 ? `Ediciones incluidas: te queda 1 de ${e.total} en este periodo de facturación` : `Ediciones incluidas: te quedan ${e.remaining} de ${e.total} en este periodo de facturación`
  if (e.unlimited) return 'Unlimited edits'
  return `Edits included: ${e.remaining} of ${e.total} left this billing period`
}
