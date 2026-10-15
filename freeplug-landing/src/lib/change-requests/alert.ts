import 'server-only'
import { sendMail, type MailResult } from '@/lib/email/mailer'

/**
 * Aria ruling 7: the change_requests row failed but the change is safe in the request notes.
 * Tell the admins (ADMIN_EMAILS) so the request isn't missed in /admin/change-requests.
 * Through the app mailer (Resend; locally RESEND_BASE_URL points at a shim that drops it in Mailpit).
 * Never throws. Holds no customer contact data: the change itself is in the request notes.
 */
export type RowFailedAlert = {
  userId: string
  websiteRequestId: string | null
  businessName: string
  changeType: string
  page: string
  reason: string
}

export function adminAlertRecipients(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+$/.test(e))
}

export function rowFailedAlertText(a: RowFailedAlert): { subject: string; text: string } {
  return {
    subject: `Change request not saved to the list: ${a.businessName}`.slice(0, 150),
    text: [
      'A Help chat change request could not be saved to /admin/change-requests.',
      'It IS saved in the website request notes (/admin/requests), so nothing is lost.',
      '',
      `Business: ${a.businessName}`,
      `Type: ${a.changeType}`,
      `Page: ${a.page}`,
      `Website request: ${a.websiteRequestId ?? '(none)'}`,
      `User id: ${a.userId}`,
      `Error: ${a.reason.slice(0, 300)}`,
      '',
      'The customer was told it was sent. Nothing was charged.',
    ].join('\n'),
  }
}

export async function sendRowFailedAlert(a: RowFailedAlert): Promise<MailResult | { success: false; error: string; reason: 'no_recipients' }> {
  const to = adminAlertRecipients()
  if (to.length === 0) {
    console.error('[change-requests] admin alert not sent: ADMIN_EMAILS is empty')
    return { success: false, error: 'ADMIN_EMAILS is empty', reason: 'no_recipients' }
  }
  const { subject, text } = rowFailedAlertText(a)
  try {
    const res = await sendMail({ to, subject, text, replyTo: null, template: 'change-request-row-failed' })
    if (!res.success) console.error('[change-requests] admin alert not sent', res.reason, res.error)
    else console.info('[change-requests] admin alert sent', res.id)
    return res
  } catch (e) {
    console.error('[change-requests] admin alert threw', e instanceof Error ? e.message : String(e))
    return { success: false, error: 'threw', reason: 'local_error' }
  }
}
