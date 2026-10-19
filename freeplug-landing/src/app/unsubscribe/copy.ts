/** PLACEHOLDER copy (box draft, Oct 19) for Sable's review. English only. */
export const UNSUBSCRIBE_COPY = {
  heading: 'Unsubscribe',
  confirm: (email: string) => `Stop Freeplug emails to ${email}?`,
  button: 'Unsubscribe',
  working: 'Unsubscribing…',
  done: (email: string) => `Done. We won't email ${email} again.`,
  error: "We couldn't save that. Please try again, or reply \"stop\" to our email.",
  invalid: "This unsubscribe link isn't valid. Reply \"stop\" to our email and we'll take you off the list.",
} as const
