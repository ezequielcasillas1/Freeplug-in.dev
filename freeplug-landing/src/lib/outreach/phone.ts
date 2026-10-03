/**
 * Phone numbers (Vera's round 2 bug 3, Sable 1:18 AM): a 10-digit US number including the area
 * code, saved and shown as 512-555-0142 however it was typed. A leading country code 1 (11 digits,
 * e.g. "+1 512 555 0142") is accepted and dropped. Used on the client and the server.
 */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  if (d.length !== 10) return null
  // Only digits and the usual separators; letters or other text mean it isn't a phone number.
  if (/[^\d\s().+\-]/.test(raw)) return null
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** For display: the 512-555-0142 form when the value is a valid number, otherwise unchanged. */
export function displayPhone(raw: string): string {
  return normalizePhone(raw) ?? raw
}
