import { PRIORITY_HELP_ANSWER, PRIORITY_HELP_QUESTION } from '@/lib/plans/priority'
import { SUPPORT_HOURS } from '@/lib/support-hours'
import { BUYOUT_FAQ_ANSWER } from '@/lib/buyout/buyout'

/**
 * Scripted help chat (no AI). Wording is Sable's Sep 25 spec (sable-deliverables-2026-09-25.md, section 3).
 *
 * Quick-question answers are the LOCKED English source lines, word for word
 * (/workspace/freeplug-qa/freeplug-english-source-LOCKED-2026-09-24.txt). Each answer notes the
 * locked file:line it comes from. Do not edit an answer here without updating the locked file;
 * help-chat-content.test.ts compares them when the locked file is present.
 */

export type HelpQuickQuestion = {
  id: string
  question: string
  answer: string
  /**
   * Locked-file reference: the start of the locked line (source file:line, or the label Sable used
   * for newer entries). When a label appears more than once, the latest entry in the file wins.
   */
  lockedRef: string
}

export const HELP_CHAT_GREETING = 'Hi! Pick a question below, or tell us about a change you need.'

export const HELP_QUICK_QUESTIONS: readonly HelpQuickQuestion[] = [
  {
    id: 'is-it-free',
    question: 'Is it really free?',
    // faq:26 (hosting required, Sable Sep 25 2:52 PM)
    answer:
      'Yes. Website development is free. 72 After designs and builds your website at no charge. After your site is live, you pay for monthly hosting, which is required. Maintenance or a buyout costs extra only if you ask for it. There are no hidden fees or surprise charges.',
    lockedRef: 'faq/page.tsx:26',
  },
  {
    id: 'what-do-i-pay',
    question: 'What do I pay for?',
    // faq:32 (hosting required, Sable Sep 25 2:52 PM)
    answer:
      "Hosting is required. It keeps your website online and costs $35 to $100 per month. You can add one optional add-on: Basic (+$5/mo), Plus (+$10/mo), or Pro (+$15/mo). Maintenance starts at $50, up to $100. You'll see the exact price before you pay. Building the website is free.",
    lockedRef: 'faq/page.tsx:32',
  },
  {
    id: 'hidden-fees',
    question: 'Are there any hidden fees?',
    // help:91 word for word (Sable Sep 25 3:30 PM; names the buyout fee)
    answer:
      "No. You pay for monthly hosting, which is required, plus any add-on you choose. One-time maintenance or a buyout costs extra only if you request it. Building your website is free, and you'll see the price before you pay.",
    lockedRef: 'help/page.tsx:91',
  },
  {
    id: 'how-long',
    question: 'How long will my site take?',
    // help:59
    answer:
      "We'll give you a timeline after we review your request. The process includes the first design, your revisions, and launch. Most of the time depends on how quickly we get your details and approvals. We'll keep you updated along the way.",
    lockedRef: 'src/app/(dashboard)/dashboard/help/page.tsx:59',
  },
  {
    id: 'payment-method',
    question: 'How do I update my payment method?',
    // help:79
    answer:
      'Go to your dashboard and open Manage billing. After your first payment, you can manage your billing and payment method there.',
    lockedRef: 'src/app/(dashboard)/dashboard/help/page.tsx:79',
  },
  {
    id: 'cancel-plan',
    question: 'How do I cancel my plan?',
    // help:85 (revised Sable Sep 25 3:30 PM: buyout instead of "export your data")
    answer:
      "Yes, you can cancel at any time. Choose Cancel options in your dashboard. Your website stays online until the end of your paid period. If you want to keep your website, you can request a buyout quote.",
    lockedRef: 'help/page.tsx:85',
  },
  {
    id: 'buy-website',
    question: 'Can I buy my website?',
    // Buyout answer (Sable Sep 25 3:15 PM, revised 3:19 PM): the FAQ answer, word for word.
    answer: BUYOUT_FAQ_ANSWER,
    lockedRef: 'FAQ (new answer)',
  },
  {
    id: 'reset-password',
    question: 'How do I reset my password?',
    // help:143
    answer:
      'On the sign-in page, click "Forgot password?" and enter your email. We\'ll email you a link to set a new password. No email after a few minutes? Check your spam folder, or email support@freeplug-in.dev. If you sign in with Google, use "Continue with Google" instead.',
    lockedRef: 'src/app/(dashboard)/dashboard/help/page.tsx:143',
  },
  {
    id: 'request-changes',
    question: 'Can I request changes to my site?',
    // help:111
    answer:
      "Yes. The Plus and Pro add-ons include one small edit each month. For other changes, request maintenance from your dashboard. Maintenance starts at $50, up to $100. You'll see the exact price before you pay.",
    lockedRef: 'src/app/(dashboard)/dashboard/help/page.tsx:111',
  },
  {
    id: 'priority',
    question: PRIORITY_HELP_QUESTION,
    // Approved by Ezequiel Sep 25 (Priority at $55/month or more); added to the locked file.
    answer: PRIORITY_HELP_ANSWER,
    lockedRef: 'help page (plans answer)',
  },
]

/** Step 1 choices for the guided change request. */
export const CHANGE_TYPES = [
  'Text or prices',
  'Photos',
  'Hours or contact info',
  'Something else',
] as const

export type ChangeType = (typeof CHANGE_TYPES)[number]

export const CHANGE_REQUEST_COPY = {
  step1: 'What would you like changed?',
  step2: 'Which page is it on?',
  step2Placeholder: 'For example: Home, Services, Contact',
  step3: 'Describe the change.',
  step3Placeholder: 'What should it say or show instead?',
  step4: 'Add a photo or screenshot (optional).',
  review:
    "Here's your request. We'll review it and tell you the price before any paid work starts.",
  send: 'Send request',
  edit: 'Edit',
  /** Only shown when the customer has the Plus or Pro add-on. */
  monthlyEditNote: 'Your plan includes one small edit each month.',
} as const

export function changeRequestSentMessage(email: string): string {
  return `Got it. We'll email you at ${email} after we review your request.`
}

/** Strict: hours come from SUPPORT_HOURS (exact days, times and "(Central time)"). */
export const HELP_CHAT_NOT_FOUND = `Didn't find your answer? Email support@freeplug-in.dev. Our team is available ${SUPPORT_HOURS}.`
