import { AUTH_MAINTENANCE } from '@/lib/auth/signups-paused'

/**
 * CTA pause (Cheke, Oct 31, 2026, 2:46 AM CT): the "Get started"-style buttons that went to Cal.com
 * (because of AUTH_MAINTENANCE) are paused: a disabled "Coming soon" button, plus the in-development
 * line in their section. Flip to false to bring the Cal.com links back. "Book a live session" links
 * are not covered by this flag.
 */
export const CTA_PAUSED = true

/** True when a Get-started CTA would have gone to Cal.com and is paused instead. */
export const CTA_PAUSED_NOW = CTA_PAUSED && AUTH_MAINTENANCE

/** Same line as the hero pill (public.landing.hero.freeplugOutreach72AfterBuilds). ES: Sable draft. */
export function ctaPauseCopy(locale: string): { button: string; line: string } {
  return locale === 'es'
    ? { button: 'Muy pronto', line: 'Freeplug está en desarrollo. Muy pronto.' }
    : { button: 'Coming soon', line: 'Freeplug is currently in development. Launching soon.' }
}
