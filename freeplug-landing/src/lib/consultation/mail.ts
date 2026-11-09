import 'server-only'

import type { ReactElement } from 'react'
import { sendMail, type MailResult } from '@/lib/email/mailer'

/**
 * Consultation emails. TEST MODE (card, Oct 22 2026): nothing is sent. Every message is written to
 * the server log instead (subject, template, recipient). Real sending needs BOTH:
 *   CONSULTATION_MAIL_MODE=send  and  Cheke's go-ahead (team inbox routing is not deployed yet).
 */
export const TEAM_INBOX = 'fplgn.dev.clients@gmail.com'

export type ConsultationMailMode = 'log' | 'send'
export function consultationMailMode(): ConsultationMailMode {
  return process.env.CONSULTATION_MAIL_MODE?.trim() === 'send' ? 'send' : 'log'
}

export type ConsultationMailResult = MailResult | { success: true; id: 'logged'; logged: true }

export const loggedMail: { to: string; subject: string; template: string }[] = []

export async function sendConsultationMail(p: {
  to: string
  subject: string
  template: string
  react: ReactElement
}): Promise<ConsultationMailResult> {
  if (consultationMailMode() !== 'send') {
    loggedMail.push({ to: p.to, subject: p.subject, template: p.template })
    if (loggedMail.length > 50) loggedMail.shift()
    console.info(`[consultation-mail] TEST MODE, not sent: template=${p.template} to=${p.to} subject="${p.subject}"`)
    return { success: true, id: 'logged', logged: true }
  }
  return sendMail({ to: p.to, subject: p.subject, template: p.template, react: p.react })
}
