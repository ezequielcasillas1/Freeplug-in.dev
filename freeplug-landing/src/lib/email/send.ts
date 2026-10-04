// Server-only helpers. Deliberately NOT 'use server': that directive would expose every export
// below as a public server action anyone could call to send mail from our address (Resend).
import 'server-only'

import { sendMail, type MailResult } from './mailer'
import { WelcomeEmail } from './templates/welcome'
import { PaymentReceivedEmail } from './templates/payment-received'
import { RequestStatusUpdateEmail } from './templates/request-status-update'
import {
  SUBSCRIPTION_CANCELLED_SUBJECT,
  SubscriptionCancelledEmail,
} from './templates/subscription-cancelled'
import { BillingReminderEmail } from './templates/billing-reminder'
import { PasswordResetEmail } from './templates/password-reset'
import { AddonRefundedEmail } from './templates/addon-refunded'
import { addonRefundEmailSubject } from '@/lib/plans/ladder-copy'

type SendResult = MailResult

/** Optional per-send overrides (replyTo, Resend idempotency key, timeout). Existing callers can omit it. */
type SendOptions = { replyTo?: string | string[]; idempotencyKey?: string; timeoutMs?: number }

export async function sendWelcomeEmail(
  to: string,
  userName?: string,
  options?: SendOptions
): Promise<SendResult> {
  return sendMail({
    to,
    subject: 'Welcome to Freeplug!',
    template: 'welcome',
    react: WelcomeEmail({ userName }),
    replyTo: options?.replyTo,
    idempotencyKey: options?.idempotencyKey,
    timeoutMs: options?.timeoutMs,
  })
}

export async function sendPaymentReceivedEmail(
  to: string,
  params: {
    userName?: string
    amount: string
    planName: string
    invoiceNumber?: string
    paymentDate: string
    nextBillingDate?: string
    totalPaidToDate?: string
  },
  options?: SendOptions
): Promise<SendResult> {
  return sendMail({
    to,
    subject: `Payment received - ${params.amount}`,
    template: 'payment-received',
    react: PaymentReceivedEmail(params),
    replyTo: options?.replyTo,
    idempotencyKey: options?.idempotencyKey,
    timeoutMs: options?.timeoutMs,
  })
}

export async function sendRequestStatusUpdateEmail(
  to: string,
  params: {
    userName?: string
    businessName: string
    newStatus: 'submitted' | 'in_review' | 'closed'
    message?: string
  },
  options?: SendOptions
): Promise<SendResult> {
  return sendMail({
    to,
    subject: `Request Update: ${params.businessName}`,
    template: 'request-status-update',
    react: RequestStatusUpdateEmail(params),
    replyTo: options?.replyTo,
    idempotencyKey: options?.idempotencyKey,
    timeoutMs: options?.timeoutMs,
  })
}

export async function sendSubscriptionCancelledEmail(
  to: string,
  params: {
    userName?: string
    planName?: string
    endDate: string
    totalPaidToDate?: string
  },
  options?: SendOptions
): Promise<SendResult> {
  return sendMail({
    to,
    subject: SUBSCRIPTION_CANCELLED_SUBJECT,
    template: 'subscription-cancelled',
    react: SubscriptionCancelledEmail(params),
    replyTo: options?.replyTo,
    idempotencyKey: options?.idempotencyKey,
    timeoutMs: options?.timeoutMs,
  })
}

/** Aria, Oct 4 9:27: an add-on charge was refunded automatically (why + where the money went). */
export async function sendAddonRefundedEmail(
  to: string,
  params: { userName?: string; addonName: string; note: string; subject?: string },
  options?: SendOptions
): Promise<SendResult> {
  return sendMail({
    to,
    subject: params.subject ?? addonRefundEmailSubject(params.addonName),
    template: 'addon-refunded',
    react: AddonRefundedEmail(params),
    replyTo: options?.replyTo,
    idempotencyKey: options?.idempotencyKey,
    timeoutMs: options?.timeoutMs,
  })
}

export async function sendBillingReminderEmail(
  to: string,
  params: {
    userName?: string
    planName: string
    amount: string
    billingDate: string
    daysUntilBilling: number
  },
  options?: SendOptions
): Promise<SendResult> {
  return sendMail({
    to,
    subject: `Upcoming billing reminder - ${params.amount} on ${params.billingDate}`,
    template: 'billing-reminder',
    react: BillingReminderEmail(params),
    replyTo: options?.replyTo,
    idempotencyKey: options?.idempotencyKey,
    timeoutMs: options?.timeoutMs,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  params: {
    resetLink: string
    userName?: string
    expiresIn?: string
  },
  options?: SendOptions
): Promise<SendResult> {
  return sendMail({
    to,
    subject: 'Reset your Freeplug password',
    template: 'password-reset',
    react: PasswordResetEmail(params),
    replyTo: options?.replyTo,
    idempotencyKey: options?.idempotencyKey,
    timeoutMs: options?.timeoutMs,
  })
}
