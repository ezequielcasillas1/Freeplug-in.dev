/**
 * Consultation step copy. Box draft (Oct 22, 2026): final-quality placeholders until Sable's copy
 * lands. Every customer-facing string for the feature lives here so it is one file to swap.
 */
export const CONSULT_CARD_HEADING = 'Next: your consultation'
export const CONSULT_CARD_BODY =
  'Before we build anything, we make sure we understand exactly what you want. Pick whichever way suits you.'

export const PATH_FORM_TITLE = 'Fill in the details'
export const PATH_FORM_BODY =
  'Answer a few questions about your pages, look, content, domain and plan. Save any time and come back later.'
export const PATH_FORM_CTA = 'Start the form'

export const PATH_LIVE_TITLE = 'Talk to us live'
export const PATH_LIVE_BODY =
  'Book a short session by phone, FaceTime, webcam or text. We take the notes and send you a summary to check.'
export const PATH_LIVE_CTA = 'Book a session'
export const PATH_LIVE_15_CTA = 'Book 15 minutes'
export const PATH_LIVE_30_CTA = 'Book 30 minutes'

export const FORM_PAGE_HEADING = 'Tell us about your website'
export const FORM_PAGE_INTRO =
  'Your answers are your consultation. Fields marked * are needed before you send it for review; you can save a draft any time.'
export const SAVE_DRAFT_LABEL = 'Save and finish later'
export const SAVED_DRAFT_MESSAGE = 'Saved. You can come back any time from your dashboard.'
export const REVIEW_LABEL = 'Review my summary'
export const SWITCH_TO_LIVE = 'Prefer to talk it through? Book a live session instead'
export const SWITCH_TO_FORM = 'Prefer to type it out? Fill in the details instead'

export const LIVE_PAGE_HEADING = 'Book a live session'
export const LIVE_PAGE_INTRO =
  'Choose how you want to talk, then pick a time. Sessions take about 20 minutes.'
export const LIVE_METHOD_LABELS = {
  phone: 'Phone call',
  facetime: 'FaceTime',
  webcam: 'Webcam (Google Meet or Zoom link)',
  text: 'Text messages',
} as const
export const LIVE_METHOD_HINTS = {
  phone: 'We call the number you give us at your booked time.',
  facetime: 'We FaceTime you at your booked time. Give us the number or Apple ID email you use for FaceTime.',
  webcam: 'Your booking confirmation includes the video link. Use your own browser or app.',
  text: 'We text you at your booked time. A person on our team writes every message.',
} as const
export const CONTACT_NUMBER_LABEL = 'Your mobile number'
export const FACETIME_CONTACT_LABEL = 'Your FaceTime number or Apple ID email'
export const PHONE_CONSENT_TEXT =
  'I agree that Freeplug may call me at this number about my website request. I can ask you to stop at any time.'
export const TEXT_CONSENT_TEXT =
  'I agree that Freeplug may send me text messages at this number about my website request. Message and data rates may apply. Reply STOP to opt out at any time.'
export const CONSENT_REQUIRED_ERROR = 'Please check the box so we can contact you at this number.'
export const SCHEDULER_HEADING = 'Pick a time'
export const SCHEDULER_TEST_MODE_NOTE =
  'Live booking is off in this test build. You can still send your details with the form.'
export const LIVE_METHOD_LEGEND = 'How do you want to talk? *'
export const SCHEDULER_IFRAME_TITLE = 'Book a time'
export const OPENS_IN_NEW_TAB = '(opens in a new tab)'
export const BOOKING_REF_HINT =
  "Already booked? If your time didn't fill in on its own, paste your booking confirmation link or the time here."
export const SESSION_TIME_LABEL = 'Session time'
export const BOOKED_THANKS = 'Booked. Thanks!'
export const bookingRefLine = (value: string) => `Booking: ${value}`
export const BACK_TO_DASHBOARD = '← Back to dashboard'
export const BOOKING_CONFIRM_LABEL = 'Confirm booking'
export const LIVE_BOOKED_HEADING = 'Your session is booked'
export const liveBookedBody = (when: string | null, method: string) =>
  `${when ? `See you ${when}` : 'See you soon'} by ${method}. After the session we will send you a written summary to check.`
export const RESCHEDULE_LABEL = 'Change method or time'

export const REVIEW_HEADING = 'Review your summary'
export const REVIEW_INTRO_CLIENT = "Here's everything you told us. Check it carefully before you confirm."
export const REVIEW_INTRO_TEAM = "Here's what we agreed on in your session. Check it carefully before you confirm."
export const LOOKS_GOOD_LABEL = 'Looks good'
export const CHANGE_SOMETHING_LABEL = 'Change something'
export const LOOKS_GOOD_NOTE =
  'Clicking Looks good confirms this plan. Nothing is built, charged or bought until you do.'
export const AGREED_HEADING = "Thanks, you're all set"
export const AGREED_BODY = "We have your agreed plan and we'll be in touch about the build. Here's a copy for your records."
export const NOT_READY_ERROR = 'This summary is not ready to confirm yet.'
export const INCOMPLETE_PREFIX = 'Please answer: '
export const NO_OPEN_REQUEST = 'Submit a website request first, then come back here for your consultation.'
export const LOCKED_AFTER_AGREED = 'Your summary is agreed and can no longer be changed here. Email support@freeplug-in.dev for changes.'

/** Emails (log-only in test mode; see ./mail.ts). */
export const EMAIL_SUMMARY_READY_SUBJECT = 'Review your website summary'
export const EMAIL_AGREED_TEAM_SUBJECT = (business: string) => `Consultation agreed: ${business}`
export const EMAIL_AGREED_CLIENT_SUBJECT = 'Your website plan is confirmed'
export const EMAIL_LIVE_BOOKED_TEAM_SUBJECT = (business: string) => `Live consultation booked: ${business}`

/** Shown when a build charge or domain purchase is tried before "Looks good" (gate.ts). */
export const CONSULTATION_GATE_MESSAGE =
  'Please finish your consultation first. Once you click Looks good on your summary, you can choose a plan or a domain.'
export const CONSULTATION_GATE_CTA = 'Go to your consultation'

/** Close / Request to cancel (Aria, Oct 22 8:37 PM CT: no self-close at building) and the buyout block. */
export const BUYOUT_BLOCKED_OPEN_REQUEST =
  "You have an open website request. Finish or close it first."
export const BUYOUT_BLOCKED_OPEN_REQUEST_LINK =
  "View your request"
export const CLOSE_REQUEST_INTRO =
  "No longer need this website? You can close your request."
export const CLOSE_REQUEST_BUTTON =
  "Close request"
export const CLOSE_REQUEST_CONFIRM =
  "Close this request? You can start a new one later."
export const CLOSE_REQUEST_ERROR =
  "We couldn't close your request. Please try again."
export const CLOSE_BUILDING_REFUSED =
  "Your website is being built, so this request can't be closed here. Use Request to cancel."
export const REQUEST_CANCEL_INTRO =
  "Your website is being built, so the request can't be closed from here. Ask us to cancel and the team will get back to you."
export const REQUEST_CANCEL_BUTTON =
  "Request to cancel"
export const REQUEST_CANCEL_CONFIRM =
  "Send a cancel request to the Freeplug team?"
export const REQUEST_CANCEL_SENT =
  "Thanks. We got your cancel request and will contact you. Your build stays as it is until then."
export const REQUEST_CANCEL_ERROR =
  "We couldn't send your cancel request. Please try again."
export const EMAIL_CANCEL_REQUEST_TEAM_SUBJECT = (business: string) => `Cancel requested during build: ${business}`

/*
 * i18n: every string above is mirrored in messages/en.json and messages/es.json under
 * `consultation.*` (camelCase of the export name). es.json holds the English text as a fallback,
 * listed in messages/pending-sable.json → spanishEnglishFallback (TODO Sable).
 * src/i18n/consultation-catalog.test.ts fails if this file and the catalogs drift.
 * Locale-aware callers can use consultationTranslator(locale).
 */
