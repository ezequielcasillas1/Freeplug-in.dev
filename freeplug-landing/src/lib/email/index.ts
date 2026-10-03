export { getResend, isResendConfigured, EMAIL_FROM, EMAIL_REPLY_TO } from './resend'
export {
  isSmtpConfigured,
  getSmtpTransport,
  getEmailFrom,
  getDefaultReplyTo,
  sendMail,
} from './smtp'
export type { MailParams, MailResult } from './smtp'
export {
  sendWelcomeEmail,
  sendPaymentReceivedEmail,
  sendRequestStatusUpdateEmail,
  sendSubscriptionCancelledEmail,
  sendBillingReminderEmail,
  sendPasswordResetEmail,
} from './send'
