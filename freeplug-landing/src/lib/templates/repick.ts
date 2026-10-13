/**
 * L1 (Lina: the type-changed banner "stays until they pick again"). changeBusinessType sets a per-request
 * httpOnly cookie when it clears a pick; a successful save deletes it. ?repick=1 still works on its own.
 */
export function repickCookieName(requestId: string): string {
  return `fp_repick_${requestId.replace(/[^0-9a-f-]/gi, '')}`
}

/** Show the banner while no new pick exists and either the flag param or the cookie says the type changed. */
export function showTypeCleared(param: string | string[] | undefined, cookie: string | undefined, templateChoice: string | null | undefined): boolean {
  if (templateChoice) return false
  const p = Array.isArray(param) ? param[0] : param
  return p === '1' || cookie === '1'
}
