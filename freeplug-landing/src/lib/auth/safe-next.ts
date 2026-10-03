/** Path-only redirect target: must start with `/` but not `//`. */
export function safeNext(next: string): string {
  return next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}
