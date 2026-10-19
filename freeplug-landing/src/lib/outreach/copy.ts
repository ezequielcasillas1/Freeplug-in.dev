import { intlLocale } from '@/i18n/format'
import type { AppLocale } from '@/i18n/config'
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '@/lib/site'
import { PHOTO_LIMITS } from './limits'
import { CLAIM_STEP3_BODY } from '@/lib/plans/ladder-copy'

/**
 * Outreach claim flow copy. Word for word from Sable's draft
 * (/workspace/copy/freeplug-outreach-claim-copy-DRAFT-2026-09-26.md, incl. the 11:12, 11:14 and
 * 11:15 PM updates); copy.test.ts checks every string here against that file.
 * Strings marked "Lina" come from Lina's screen map; "NEW" strings are not in either file yet and
 * are listed for Sable's review.
 */

// 1. Private preview page
export const PREVIEW_BANNER_HEADING = 'We built this website for {Business Name}'
export const PREVIEW_BANNER_BODY =
  'Freeplug found your business, and 72 After built this site for it at no charge. This is a private preview, so only people with this link can see it.'
export const PREVIEW_UNDER_MAIN_BUTTON =
  "Building it was free. You won't pay anything unless you pick a hosting plan and your site goes live."
export const CLAIM_LABEL = 'Claim my website'
/**
 * Claim-start card on /claim (Sable 1:46 AM, Lina gap 1): the preview banner's card, shown only
 * once the preview link checks out (Jace). One grey line under the heading, then the red button.
 */
export const CLAIM_CARD_HEADING = PREVIEW_BANNER_HEADING
export const CLAIM_CARD_LINE =
  "Tap the button to start claiming it. You won't pay anything unless you pick a hosting plan and your site goes live."
/** Sable 1:45 AM: the 15-minute claim token ran out; replaces CLAIM_CARD_LINE on the same card. */
export const CLAIM_STALE_LINE = 'This page was open for a while, so we refreshed it. Tap Claim my website again to continue.'
/**
 * Jace's neutral page (Sable 1:57 AM, Lina 1:58 AM): /claim for a signed-in person with no saved
 * claim and no valid link on this device. Names no business and says nothing about any link.
 */
export const NEUTRAL_HEADING = 'Open your preview link on this device'
export const NEUTRAL_BODY = 'To keep going, open the link from the message we sent you, on this phone or computer.'
/** Desktop: one help line. */
export const NEUTRAL_HELP_LINE = `Can't find it? Call or text us at ${SUPPORT_PHONE_DISPLAY}, or email ${SUPPORT_EMAIL}.`
/** Phone: grey text above the Call us / Text us / Email us buttons. */
export const NEUTRAL_HELP_PHONE = "Can't find it? We can help."
/**
 * Confirm-email box (Sable 2:08 AM, Jace): signed in but the email isn't confirmed. {account email}
 * is only ever the signed-in user's own address, from the verified session.
 */
export const CONFIRM_FIRST_LINE = 'First, confirm your email. Open the email we sent to {account email} and tap the link inside.'
export const RESEND_LABEL = 'Send it again'
export const RESEND_SENT = 'Sent. Check your inbox.'
/**
 * Sable 2:22 AM (replaces her 2:10 line): shown in place of "Send it again" for EVERY limited case
 * (per-account 60 s / hourly, per-IP, shared bucket, Supabase's own limit, limit store down), where
 * nothing may have been sent. Other failures: GENERIC_TRY_AGAIN.
 */
export const RESEND_LIMITED = 'Please wait a few minutes and try again.'
export const ADD_DETAILS_LABEL = 'Add your details'
export const REQUEST_CHANGE_LABEL = 'Request a change'
export const CALL_TEXT_LABEL = 'Call or text us'
export const EMAIL_US_LABEL = 'Email us'
export const NOT_NOW_LABEL = 'Not right now'
export const NOT_NOW_CONFIRM = 'No problem. You can come back to this link until {expiry date}.'
export const EXPIRED_HEADING = 'This preview link has expired'
/** Final expired body (Sable, 11:57 PM update). */
export const EXPIRED_BODY = `To see your website, call or text us at ${SUPPORT_PHONE_DISPLAY}, or email ${SUPPORT_EMAIL}.`
export const OPEN_FULL_SCREEN_LABEL = 'Open full screen'
export const SCREENSHOT_NOTE =
  "This is a picture of your website, so its buttons won't work here. Open full screen to try them."
/** Contact links (Sable, Sep 27 12:00 AM update: Vera's tel/sms split). */
export const DESKTOP_CONTACT_TEXT = `Call or text us: ${SUPPORT_PHONE_DISPLAY}`
export const CALL_US_LABEL = 'Call us'
export const TEXT_US_LABEL = 'Text us'
export const CALL_ARIA = `Call ${SUPPORT_PHONE_DISPLAY}`
export const TEXT_ARIA = `Text ${SUPPORT_PHONE_DISPLAY}`
export const EMAIL_ARIA = `Email ${SUPPORT_EMAIL}`

// 2. Add your details
export const DETAILS_HEADING = 'Add your details'
/** Prefilled version (11:14 PM update; replaces the section 2 intro). */
export const DETAILS_INTRO =
  "We filled in what we found online. Check each detail and fix anything that's wrong. Nothing on your site changes until we review it."
export const FIELD_PHONE = 'Business phone'
export const FIELD_ADDRESS = 'Business address'
export const FIELD_ADDRESS_HELP = "Leave this blank if customers don't come to you."
export const FIELD_HOURS = 'Hours'
export const FIELD_SERVICE_AREA = 'Service area'
export const FIELD_SERVICE_AREA_HELP = 'List the cities or areas you serve.'
export const FIELD_QUOTE_EMAIL = 'Email for quote requests'
export const FIELD_QUOTE_EMAIL_HELP = 'Where should we send quote requests from your site?'
export const FIELD_PHOTOS = 'Photos'
// Photo limit (Sable's 12:04 / 12:05 AM updates). The number comes from PHOTO_LIMITS.
export const FIELD_PHOTOS_HELP = `Photos of your real work help customers trust you. You can send up to ${PHOTO_LIMITS.maxPerLink} photos, 10 MB each (JPG, PNG, WebP, or iPhone HEIC).`
export const SEND_DETAILS_LABEL = 'Send my details'
export const DETAILS_SUCCESS =
  "Thanks, we got your details. You'll see them in your preview once we've added them."
export const ERROR_TOO_LARGE = 'That photo is too large. Please upload one under 10 MB.'
// Sable 12:49 AM: server-side refusals (the server only sees the already-shrunk file, so no
// "10 MB" or "HEIC" promise here). The page lines above stay as they are.
export const SERVER_TOO_LARGE = `That photo is too large to upload. Try a smaller photo, or email it to ${SUPPORT_EMAIL}.`
export const SERVER_BAD_TYPE = `We couldn't use this photo. Try it as a JPG or PNG, or email it to ${SUPPORT_EMAIL}.`
export const ERROR_TOO_MANY_TRIES = "You've sent this form a few times already. Please try again later."
export const ERROR_TOO_MANY_PHOTOS = `You can send up to ${PHOTO_LIMITS.maxPerLink} photos. Remove one to add another.`
export const SOURCE_LINE = 'From your {source}'
export const LOOKS_RIGHT_LABEL = 'Looks right'
export const EDIT_LABEL = 'Edit'
export const BLANK_FIELD_HINT = "We couldn't find this online. Please add it."
export const SERVICES_HEADING = 'Services you offer'
export const SERVICES_INTRO =
  "These are the services on the website we built for you. Keep the ones you offer, remove any you don't, and add any we missed."
// Service source labels (Sable, Sep 27 12:02 AM)
export const SERVICE_SOURCE_SITE = 'On your new website'
export const SERVICE_SOURCE_SITE_AND_THUMBTACK = 'On your new website and your Thumbtack profile'
export const SERVICE_SOURCE_THUMBTACK_ONLY = 'From your Thumbtack profile'
export const KEEP_LABEL = 'Keep'
export const REMOVE_LABEL = 'Remove'
export const UNDO_LABEL = 'Undo'
export const ADD_SERVICE_LABEL = 'Add a service'
export const ADD_LABEL = 'Add'
export const COUNTER_TEXT = '{n} of {total} checked'

// 3. Claim steps
export const STEP1_HEADING = 'Create your account'
export const STEP1_BODY = "We've filled in your business name and email. Check them and choose a password."
/** Sable 12:35 AM: step 1 body when only the business name is pre-filled (no email on file). */
export const STEP1_BODY_NAME_ONLY = "We've filled in your business name. Check it, add your email, and choose a password."
/** Sable 12:35 AM: claim step 1 footer and back link. */
/** Claim step 1 body: the name-only line unless the email is pre-filled too (Sable 12:35 AM). */
export function step1Body(contactEmail: string | null | undefined): string {
  return contactEmail && contactEmail.trim() ? STEP1_BODY : STEP1_BODY_NAME_ONLY
}
export const STEP1_SIGN_IN_PROMPT = 'Already have an account?'
export const STEP1_SIGN_IN_LINK = 'Sign in'
export const STEP1_BACK_LINK = 'Back to your preview'
export const STEP1_BUTTON = 'Create account'
export const STEP2_HEADING = 'Confirm your details'
export const STEP2_BODY = 'Check that everything is right before your site goes live.'
/** Step 2 checklist labels (Sable: Phone / Address / Hours / Service area / Email for quote requests / Photos). */
export const CHECK_PHONE = 'Phone'
export const CHECK_ADDRESS = 'Address'
export const CHECK_HOURS = 'Hours'
export const CHECK_SERVICE_AREA = 'Service area'
export const CHECK_QUOTE_EMAIL = 'Email for quote requests'
export const CHECK_PHOTOS = 'Photos'
export const STEP2_BUTTON = 'Confirm details'
export const UPLOAD_PHOTOS_LABEL = 'Upload photos'
export const STEP3_HEADING = 'Choose your hosting plan'
/** Claim step 3 body: built from the ladder (src/lib/plans/ladder-copy.ts, PLACEHOLDER until Sable). */
export const STEP3_BODY = CLAIM_STEP3_BODY
export const STEP3_BUTTON = 'Choose this plan'
export const NO_CHARGE_UNTIL_LIVE = "You won't be charged until your site goes live."
// Step 4 saves the card only (Sable 12:38 AM, overrides "Go live" / "Publish my website").
export const STEP4_HEADING = 'Add your card'
export const STEP4_BODY =
  "Add the card you want to pay with. We'll save it now and won't charge it until your site goes live."
export const STEP4_BUTTON = 'Add my card'
export const STEP4_NOTE = "You'll enter your card on Stripe's payment page."
// Waiting screen after the card is saved (Sable 12:38 AM).
export const CARD_SAVED_LINE = 'Your card is saved.'
/** Final WAITING_LINE: publishing sends no "your site is live" email in this version. */
export const WAITING_LINE = "You're all set. Your dashboard will show when your site is live."

// 4. Dashboard after claiming
export const TRACKER_OUTREACH_STEPS = [
  'Built',
  'Your review',
  'Details confirmed',
  'Hosting set up',
  'Live',
] as const
export const VIEW_WEBSITE_LABEL = 'View my website'
export const SET_UP_DOMAIN_LABEL = 'Set up my domain'
export const MANAGE_BILLING_LABEL = 'Manage billing'
export const DOMAIN_HELPER = 'Until you connect your own domain, your site runs on a free web address we give you.'
export const NEED_DOMAIN_LABEL = 'I need a domain'
export const NEED_DOMAIN_HELPER =
  "You buy and own your domain. We'll send you step-by-step instructions and connect it for you."
export const ADMIN_PUBLISH_CONFIRM = 'This starts billing for {Business}.'
export const ADMIN_PUBLISH_BUTTON = 'Publish and start billing'
export const ADMIN_CANCEL_BUTTON = 'Cancel'

// Lina's screen map (not in Sable's file)
export const STEP_NAMES = ['Account', 'Your details', 'Hosting plan', 'Add card'] as const
export const CLAIMING_FOR_LINE = 'Claiming the website for {Business Name}'
export const GO_TO_DASHBOARD_LABEL = 'Go to my dashboard'
export const VIEW_PREVIEW_LABEL = 'View my preview'
export const YOUR_WEBSITE_HEADING = 'Your website'
/** Under "Live" on the outreach tracker until the site is published (Sable 1:04 AM; period as in Lina's 1:05 AM note). */
/** Phone check on the details form and the server (Sable 1:18 AM). */
export const PHONE_INVALID = 'Please enter a 10-digit phone number, including the area code.'
/** Refused-file dismiss button, screen-reader label (Sable 1:18 AM; replaces "Remove photo {n}"). */
export const REFUSED_DISMISS_ARIA = 'Dismiss message about {file name}'
export const TRACKER_LIVE_WAITING = 'Waiting for us to publish your site.'
export const HAVE_DOMAIN_LABEL = 'I already have a domain'
export const TRACKER_ORGANIC_STEPS = [
  'Request sent',
  'Building',
  'Your review',
  'Hosting set up',
  'Live',
] as const
export const PHOTO_COUNT_TEXT = `{n} of ${PHOTO_LIMITS.maxPerLink} photos`
export const PHOTO_RETRYING_TEXT = 'Upload paused. Trying again…'
export const PHOTO_FAILED_TEXT = "This photo didn't upload. Tap to try again."
export const PHOTO_LIMIT_REACHED = `You've sent ${PHOTO_LIMITS.maxPerLink} photos, which is the most we can take here. To send more, email ${SUPPORT_EMAIL}.`
export const PHOTO_REFUSED = `We couldn't use this photo. Try it as a JPG or PNG, or email it to ${SUPPORT_EMAIL}. It doesn't count toward your ${PHOTO_LIMITS.maxPerLink}.`
export const SHOW_ALL_PHOTOS = 'Show all {n} photos'
export const SHOW_FEWER_PHOTOS = 'Show fewer photos'
// Lina's thumbnail labels (short forms of Sable's lines above)
export const THUMB_TRYING_AGAIN = 'Trying again…'
export const THUMB_TAP_TO_RETRY = 'Tap to try again'

// Sable 12:35 AM: approved as written / replacements for the build's own lines.
/** No longer shown since round 6: a signed-in person without a valid link gets the neutral page. */
export const CLAIM_REOPEN_LINK_LINE = 'Open your preview link again to finish claiming your website.'
/** Before Live only (Sable 3:27 AM): it says the customer won't be charged until the site goes live. */
export const PLAN_WAITING_FOR_PUBLISH_MESSAGE =
  "You already chose a hosting plan. You won't be charged until your site goes live."
/** Sable 3:27 AM: dashboard plan box after Live when the plan can't be loaded (plain grey text). */
export const PLAN_LIVE_UNAVAILABLE_MESSAGE = `Your site is live. We couldn't load your plan details right now. Refresh the page to try again, or email ${SUPPORT_EMAIL}.`
/**
 * Sable 3:42 AM: Account card billing line. Outreach customers before the card is added get the
 * add-card line; after Live with no Stripe customer there is no line (the plan box already has
 * the 3:27 line). Regular customers keep the first-payment line.
 */
export const ACCOUNT_ADD_CARD_LINE = 'After you add your card, you can manage your billing and payment method here.'
export const ACCOUNT_FIRST_PAYMENT_LINE = 'After your first payment, you can manage your billing and payment method here.'
/**
 * Sable 4:03 AM: /dashboard/cancel before Live, grey, under the plan-waiting message. The email is a
 * mailto link (split so the UI can wrap it). No promise about the card or timing.
 */
export const CANCEL_BEFORE_LIVE_HELP = `If you don't want to go ahead, email ${SUPPORT_EMAIL} and we'll help.`
export const GENERIC_TRY_AGAIN = `Something went wrong. Please try again. If it keeps happening, email ${SUPPORT_EMAIL}.`
// Screen-reader labels for the photo grid, numbered (up to 50 photos).
export const PHOTO_REMOVE_ARIA = 'Remove photo {n}'
export const PHOTO_UPLOADING_ARIA = 'Uploading photo {n}'
export const PHOTO_UPLOADED_ARIA = 'Photo {n} uploaded'
/** Photo box button (Sable 12:38 AM: "+ Add photos"; the "+" is drawn separately). */
export const ADD_PHOTOS_LABEL = 'Add photos'
/** Waiting screen / dashboard: "Check your email to confirm your account." (approved 12:35 AM). */
export const CONFIRM_EMAIL_LINE = 'Check your email to confirm your account.'

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (m, k: string) => (k in values ? values[k] : m))
}

export function formatExpiryDate(d: Date, locale: AppLocale = 'en'): string {
  return d.toLocaleDateString(intlLocale(locale), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  })
}
export const PREVIEW_CHANGE_SENT = "Got it. We'll review your request and let you know when your preview is updated."
export const DOMAIN_REQUEST_SENT = "Got it. We'll email you the next steps for your domain."
