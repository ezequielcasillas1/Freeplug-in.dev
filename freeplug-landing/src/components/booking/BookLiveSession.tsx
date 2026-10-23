import { CALCOM_BOOKING_URL } from '@/lib/booking'

/** Cal.com booking link (opens in a new tab). Caller passes translated label + sr-only hint. */
export function BookLiveSessionLink({
  label,
  newTabHint,
  className,
}: {
  label: string
  newTabHint: string
  className?: string
}) {
  return (
    <a
      href={CALCOM_BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-testid="book-live-session"
    >
      {label}
      <span className="sr-only"> {newTabHint}</span>
    </a>
  )
}
