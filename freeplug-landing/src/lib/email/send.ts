'use server'

import { getResend, EMAIL_FROM, isResendConfigured } from './resend'
import { WelcomeEmail } from './templates/welcome'
import { PaymentReceivedEmail } from './templates/payment-received'
import { RequestStatusUpdateEmail } from './templates/request-status-update'
import { SubscriptionCancelledEmail } from './templates/subscription-cancelled'
import { BillingReminderEmail } from './templates/billing-reminder'

type SendResult = { success: true; id: string } | { success: false; error: string }

export async function sendWelcomeEmail(
  to: string,
  userName?: string
): Promise<SendResult> {
  if (!isResendConfigured()) {
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: 'Welcome to Freeplug.dev!',
      react: WelcomeEmail({ userName }),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id ?? '' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
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
    websiteValueProgress?: string
  }
): Promise<SendResult> {
  if (!isResendConfigured()) {
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `Payment received - ${params.amount}`,
      react: PaymentReceivedEmail(params),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id ?? '' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function sendRequestStatusUpdateEmail(
  to: string,
  params: {
    userName?: string
    businessName: string
    newStatus: 'submitted' | 'in_review' | 'closed'
    message?: string
  }
): Promise<SendResult> {
  if (!isResendConfigured()) {
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `Request Update: ${params.businessName}`,
      react: RequestStatusUpdateEmail(params),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id ?? '' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function sendSubscriptionCancelledEmail(
  to: string,
  params: {
    userName?: string
    planName: string
    endDate: string
    totalPaidToDate?: string
  }
): Promise<SendResult> {
  if (!isResendConfigured()) {
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `Subscription cancelled - ${params.planName}`,
      react: SubscriptionCancelledEmail(params),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id ?? '' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function sendBillingReminderEmail(
  to: string,
  params: {
    userName?: string
    planName: string
    amount: string
    billingDate: string
    daysUntilBilling: number
  }
): Promise<SendResult> {
  if (!isResendConfigured()) {
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `Upcoming billing reminder - ${params.amount} on ${params.billingDate}`,
      react: BillingReminderEmail(params),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id ?? '' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
