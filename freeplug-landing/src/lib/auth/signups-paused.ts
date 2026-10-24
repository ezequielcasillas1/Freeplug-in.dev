/** Signups paused (Cheke, Oct 22, 2026). Flip to false to bring the sign-up form back. */
export const SIGNUPS_PAUSED = true

/**
 * Auth maintenance (Cheke, Oct 24, 2026): log in AND sign-up hidden. /login, /signup and /es/signup
 * show the maintenance card; Log in / Sign up / Dashboard links are hidden site-wide and the
 * remaining CTAs go to the Cal.com booking page. Flip to false to bring the login form and links back
 * (the original code is still in place behind this flag).
 */
export const AUTH_MAINTENANCE = true

export function authMaintenanceCopy(locale: 'en' | 'es'): { title: string; body: string } {
  return locale === 'es'
    ? {
        title: 'Mantenimiento en curso',
        body: 'El inicio de sesión y el registro están en pausa mientras trabajamos en el sitio. Vuelve pronto.',
      }
    : {
        title: 'Maintenance in progress',
        body: 'Log in and sign-up are paused while we work on the site. Please check back soon.',
      }
}

/** ?notice= value on /login when someone was sent away from sign-up (Oct 24). */
export const SIGNUP_PAUSED_NOTICE = 'signup-paused'

/** Same wording as the old /signup maintenance card. */
export function signupPausedLine(locale: 'en' | 'es'): string {
  return locale === 'es'
    ? 'El registro está en pausa mientras damos mantenimiento al sitio.'
    : 'Sign-up is paused while we do some site maintenance.'
}

/** Where /signup (and /es/signup) sends people while paused. Keeps next=/claim so claimers can log in. */
export function signupPausedLoginPath(locale: 'en' | 'es', next?: string | null): string {
  const p = new URLSearchParams({ notice: SIGNUP_PAUSED_NOTICE })
  if (locale === 'es') p.set('lang', 'es')
  if (next === '/claim') p.set('next', '/claim')
  return `/login?${p.toString()}`
}
