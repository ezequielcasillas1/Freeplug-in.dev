/** When false, public signup CTAs show “Coming soon” (matches Nov 2026 live freeplug-in.dev). */
export function isPublicSignupOpen(): boolean {
  return process.env.NEXT_PUBLIC_SIGNUP_OPEN === 'true'
}
