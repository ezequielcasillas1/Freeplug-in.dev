/**
 * SMS is OUT of launch scope (Cheke, Oct 13): launch is email only, via Resend's free plan. No Twilio, no 10DLC.
 *
 * There is no SMS sender in this codebase (no Twilio client, no Twilio env vars). This is the single explicit
 * switch any future SMS path must check first. It defaults to OFF: unset (or anything other than exactly "on")
 * means no SMS. The `sms:` links on the claim/preview pages only open the visitor's own messaging app; they
 * send nothing from Freeplug and are not affected by this flag.
 */
export function smsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.FREEPLUG_SMS_ENABLED === 'on'
}
