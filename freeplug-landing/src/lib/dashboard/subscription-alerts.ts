import type { AppLocale } from '@/i18n/config'
import { formatList } from '@/i18n/format'
import { translatorFor } from '@/i18n/translate'

/**
 * Warning text for a plan set to end; falls back to the period wording when the date is missing.
 * Sable, Oct 3 5:23 PM: "Your Fast lane plan will end in 31 days. Resume to keep your website live."
 * `planName` is the plan name only (never "+ Optional monthly tip"; the tip ends with the plan anyway).
 * A ladder step gets " plan" after its name; a grandfathered plan's product names already say what it
 * is, so they get no extra "plan" and are read as a sentence (see `grandfatheredAlertName`).
 */
export function subscriptionEndingMessage(planName: string, daysUntilEnd: number | null, ladderStep = false, locale: AppLocale = 'en'): string {
  const t = translatorFor(locale, 'dashboard.home')
  const subject = ladderStep
    ? t('alertSubjectPlan', { planName })
    : t('alertSubjectGrandfathered', { name: grandfatheredAlertName(planName, locale) })
  if (daysUntilEnd == null) return t('alertEndingNoDate', { subject })
  return t('alertEndingDays', { subject, days: daysUntilEnd })
}

const BILLING_SUFFIX = /\s*\((?:monthly|yearly|annual|annually|weekly)\)\s*$/i

/**
 * A grandfathered plan's name for the ending alert. Sable, Oct 3 5:30 PM:
 * "Your hosting plan and Pro add-on will end in 12 days. Resume to keep your website live."
 * Takes the product names joined with " + " (as `planNameOf` builds them), drops the "(monthly)"
 * parts, joins the items with "and" ("A, B and C" for three or more), and lower-cases the first
 * word when it is a plain capitalised word ("Hosting" -> "hosting"; "WordPress", "SEO" stay).
 */
export function grandfatheredAlertName(planName: string, locale: AppLocale = 'en'): string {
  const items = planName
    .split(' + ')
    .map((n) => n.replace(BILLING_SUFFIX, '').trim())
    .filter(Boolean)
  if (items.length === 0) return planName
  items[0] = items[0].replace(/^[A-Z][a-z]+\b/, (w) => w.toLowerCase())
  return formatList(items, locale)
}

/** Where the "Subscription ending" alert's "Resume plan" goes: the cancel page's Resume box (Vera B3). */
export const RESUME_PLAN_ANCHOR_HREF = '/dashboard/cancel#resume-plan'
