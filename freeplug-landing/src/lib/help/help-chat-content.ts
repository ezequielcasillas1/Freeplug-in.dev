import { PRIORITY_HELP_ANSWER, PRIORITY_HELP_QUESTION } from '@/lib/plans/priority'
import { SUPPORT_HOURS } from '@/lib/support-hours'
import { BUYOUT_FAQ_ANSWER } from '@/lib/buyout/buyout'
import {
  HELP_CHAT_INCLUDED_EDIT_NOTE,
  HELP_HIDDEN_FEES,
  HELP_REQUEST_CHANGES,
  HELP_WHAT_DO_I_PAY,
  HELP_PAYMENT_METHOD,
} from '@/lib/plans/ladder-copy'
import type { LadderCopy } from '@/lib/plans/ladder-copy'

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
  /**
   * Hosting ladder (Oct 3): the answer is a PLACEHOLDER from src/lib/plans/ladder-copy.ts until
   * Sable adds the new [STRICT] entry to the locked file; the locked-file drift check skips it.
   */
  pendingCopy?: true
}

/** lockedRef used while an answer waits for Sable's new [STRICT] line. */
export const PENDING_LADDER_COPY_REF = 'PENDING Sable: hosting ladder [STRICT] entry'

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
    // Was faq:32 (slider + add-ons). Hosting ladder PLACEHOLDER until Sable's new [STRICT] line.
    answer: HELP_WHAT_DO_I_PAY,
    lockedRef: PENDING_LADDER_COPY_REF,
    pendingCopy: true,
  },
  {
    id: 'hidden-fees',
    question: 'Are there any hidden fees?',
    // Was help:91 ("plus any add-on you choose"; add-ons are retired). PLACEHOLDER until Sable.
    answer: HELP_HIDDEN_FEES,
    lockedRef: PENDING_LADDER_COPY_REF,
    pendingCopy: true,
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
    // help:79 with Sable's Manage-billing sentence, re-locked Oct 3, 3:15 PM CT. Same constant as the help page.
    answer: HELP_PAYMENT_METHOD,
    lockedRef: 'src/app/(dashboard)/dashboard/help/page.tsx:79',
  },
  {
    id: 'cancel-plan',
    question: 'How do I cancel my plan?',
    // help:85 (revised Sable Sep 25 3:30 PM: buyout instead of "export your data")
    answer:
      "Yes, you can cancel at any time. Choose Cancel options in your dashboard. Your website stays online until the end of your paid period. If you want to keep your website, you can buy your website files. See the buyout prices in the FAQ.",
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
    // Was help:111 (Plus/Pro add-ons). Hosting ladder PLACEHOLDER until Sable.
    answer: HELP_REQUEST_CHANGES,
    lockedRef: PENDING_LADDER_COPY_REF,
    pendingCopy: true,
  },
  {
    id: 'priority',
    question: PRIORITY_HELP_QUESTION,
    // Re-locked by Sable Oct 3, 3:15 PM CT: Priority comes from the plan step; a tip never counts.
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
  /** Only shown when the plan includes the small edit (Fast lane+, or a grandfathered Plus/Pro). PLACEHOLDER. */
  includedEditNote: HELP_CHAT_INCLUDED_EDIT_NOTE,
} as const

export function changeRequestSentMessage(email: string): string {
  return `Got it. We'll email you at ${email} after we review your request.`
}

/** Strict: hours come from SUPPORT_HOURS (exact days, times and "(Central time)"). */
export const HELP_CHAT_NOT_FOUND = `Didn't find your answer? Email support@freeplug-in.dev. Our team is available ${SUPPORT_HOURS}.`

// ------------------------------------------------------------------ Spanish build (Oct 12)
/**
 * The help chat in one language, from the catalog (help.chat.*, help.answers.*, buyout.*,
 * help.priority.*). Ids, lockedRefs and CHANGE_TYPES values stay as above: the change type is
 * stored in English (admin reads it); only its on-screen label is translated. The English
 * constants above stay the word-for-word lock that help-chat-content.test.ts checks.
 */
export type HelpChatContent = {
  greeting: string
  quickQuestions: readonly Pick<HelpQuickQuestion, 'id' | 'question' | 'answer'>[]
  changeTypeLabel: Record<ChangeType, string>
  copy: { [K in keyof typeof CHANGE_REQUEST_COPY]: string }
  sentMessage: (email: string) => string
  notFound: string
  back: string
  next: string
  sending: string
  requestChange: string
  ariaLabel: string
}

type Tr = (key: string, values?: Record<string, string | number>) => string
type LadderHelpCopy = Pick<
  LadderCopy,
  'HELP_WHAT_DO_I_PAY' | 'HELP_HIDDEN_FEES' | 'HELP_PAYMENT_METHOD' | 'HELP_REQUEST_CHANGES' | 'HELP_CHAT_INCLUDED_EDIT_NOTE'
>

const QUESTION_KEYS: Record<string, [question: string, answer: string | keyof LadderHelpCopy]> = {
  'is-it-free': ['help.chat.question.reallyFree', 'help.chat.answer.yesWebsiteDevelopmentFree'],
  'what-do-i-pay': ['help.chat.question.whatDoIPay', 'HELP_WHAT_DO_I_PAY'],
  'hidden-fees': ['help.chat.question.thereAnyHiddenFees', 'HELP_HIDDEN_FEES'],
  'how-long': ['help.chat.question.longSiteTake', 'help.chat.answer.wellGiveTimelineAfter'],
  'payment-method': ['help.chat.question.updatePaymentMethod', 'HELP_PAYMENT_METHOD'],
  'cancel-plan': ['help.chat.question.cancelPlan', 'help.chat.answer.yesCancelAnyTime'],
  'buy-website': ['help.chat.question.buyWebsite', 'buyout.faqAnswer'],
  'reset-password': ['help.chat.question.resetPassword', 'help.chat.answer.signPageClickForgot'],
  'request-changes': ['help.chat.question.requestChangesSite', 'HELP_REQUEST_CHANGES'],
  priority: ['help.priority.priorityHelpQuestion', 'help.priority.priorityHelpAnswer'],
}

const CHANGE_TYPE_KEYS: Record<ChangeType, string> = {
  'Text or prices': 'help.chat.changeTypes.textPrices',
  Photos: 'help.chat.changeTypes.photos',
  'Hours or contact info': 'help.chat.changeTypes.hoursContactInfo',
  'Something else': 'help.chat.changeTypes.somethingElse',
}

export function helpChatContent(t: Tr, ladder: LadderHelpCopy): HelpChatContent {
  if (typeof t !== 'function' || !ladder || typeof ladder !== 'object') throw new TypeError('helpChatContent: translator and ladder copy required')
  return {
    greeting: t('help.chat.chatGreeting'),
    quickQuestions: HELP_QUICK_QUESTIONS.map((q) => {
      const [qk, ak] = QUESTION_KEYS[q.id]
      return { id: q.id, question: t(qk), answer: ak in ladder ? ladder[ak as keyof LadderHelpCopy] : t(ak) }
    }),
    changeTypeLabel: Object.fromEntries(CHANGE_TYPES.map((c) => [c, t(CHANGE_TYPE_KEYS[c])])) as Record<ChangeType, string>,
    copy: {
      step1: t('help.chat.step1.wouldLikeChanged'),
      step2: t('help.chat.step2.whichPage'),
      step2Placeholder: t('help.chat.step2Placeholder.exampleHomeServicesContact'),
      step3: t('help.chat.step3.describeChange'),
      step3Placeholder: t('help.chat.step3Placeholder.shouldSayShowInstead'),
      step4: t('help.chat.step4.addPhotoScreenshotOptional'),
      review: t('help.chat.review.heresRequestWellReview'),
      send: t('help.chat.send.sendRequest'),
      edit: t('help.chat.edit.edit'),
      includedEditNote: ladder.HELP_CHAT_INCLUDED_EDIT_NOTE,
    },
    sentMessage: (email) => t('help.chat.changeRequestSentMessage.gotWellEmailAfter', { email }),
    notFound: t('help.chat.chatNotFound', { supportHours: t('common.support.hours') }),
    back: t('help.chat.back'),
    next: t('help.chat.next'),
    sending: t('help.chat.sending'),
    requestChange: t('help.chat.requestChange'),
    ariaLabel: t('help.chat.ariaLabel.helpChat'),
  }
}
