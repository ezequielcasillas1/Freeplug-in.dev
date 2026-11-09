'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle,
  Book,
  Mail,
  MessageCircle,
  Clock,
  ChevronRight,
  FileText,
  CreditCard,
  Settings,
  User,
  Rocket,
  Shield,
  Globe,
  Palette,
} from 'lucide-react'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import type { LadderCopy } from '@/lib/plans/ladder-copy'
import { useLadderCopy } from '@/lib/plans/use-ladder-copy'
import { useTranslations } from 'next-intl'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

type T = (key: string, values?: Record<string, string | number>) => string

/** Labels are help.center.label.* keys. */
const tabs = [
  { id: 'faq', label: 'faq', icon: HelpCircle },
  { id: 'guides', label: 'guides', icon: Book },
  { id: 'contact', label: 'contact', icon: Mail },
] as const

type TabId = (typeof tabs)[number]['id']

function faqCategoriesFor(t: T, copy: LadderCopy) {
  const { HELP_HIDDEN_FEES, HELP_PAYMENT_METHOD, HELP_HOSTING_PLANS, HELP_REQUEST_CHANGES, HELP_SECURITY } = copy
  return [
  {
    id: 'getting-started',
    title: t('help.center.title.gettingStarted'),
    icon: Rocket,
    color: 'bg-blue-100 text-blue-600',
    questions: [
      {
        id: 'gs-1',
        question: t('help.center.question.requestWebsite'),
        answer: t('help.center.answer.goRequestWebsiteDashboard'),
      },
      {
        id: 'gs-2',
        question: t('help.center.question.informationNeedProvide'),
        answer: t('help.center.answer.youllNeedBusinessName'),
      },
      {
        id: 'gs-3',
        question: t('help.center.question.longDoesProcessTake'),
        answer: t('help.center.answer.wellGiveTimelineAfter'),
      },
    ],
  },
  {
    id: 'billing',
    title: t('help.center.title.billingPlans'),
    icon: CreditCard,
    color: 'bg-green-100 text-green-600',
    questions: [
      {
        id: 'b-1',
        question: t('help.center.question.hostingPlanOptions'),
        // PLACEHOLDER (hosting ladder, src/lib/plans/ladder-copy.ts) until Sable's [STRICT] line.
        answer: HELP_HOSTING_PLANS,
      },
      {
        id: 'b-2',
        question: t('help.center.question.updatePaymentMethod'),
        // Locked help/page.tsx:79 + Sable's Manage-billing-while-a-switch-is-planned sentence (Oct 3); shared with the help chat.
        answer: HELP_PAYMENT_METHOD,
      },
      {
        id: 'b-3',
        question: t('help.center.question.cancelPlan'),
        answer: t('help.center.answer.yesCancelAnyTime'),
      },
      {
        id: 'b-4',
        question: t('help.center.question.thereAnyHiddenFees'),
        // PLACEHOLDER (hosting ladder): add-ons are retired. Was locked help/page.tsx:91.
        answer: HELP_HIDDEN_FEES,
      },
      {
        id: 'b-5',
        question: t('help.center.question.closeRequestCancelPlan'),
        answer: t('help.center.answer.closeRequestFromRequest'),
      },
    ],
  },
  {
    id: 'technical',
    title: t('help.center.title.technicalSupport'),
    icon: Settings,
    color: 'bg-purple-100 text-purple-600',
    questions: [
      {
        id: 't-1',
        question: t('help.center.question.requestChangesWebsite'),
        // PLACEHOLDER (hosting ladder) until Sable's [STRICT] line.
        answer: HELP_REQUEST_CHANGES,
      },
      {
        id: 't-2',
        question: t('help.center.question.websiteMobileFriendly'),
        answer: t('help.center.answer.yesEverySiteBuild'),
      },
      {
        id: 't-3',
        question: t('help.center.question.helpSeoSearchEngine'),
        answer: t('help.center.answer.everySiteIncludesBasics'),
      },
      {
        id: 't-4',
        question: t('help.center.question.secureWebsite'),
        // Backups are not advertised until they're built (Aria, Oct 3). PLACEHOLDER until Sable.
        answer: HELP_SECURITY,
      },
    ],
  },
  {
    id: 'account',
    title: t('help.center.title.account'),
    icon: User,
    color: 'bg-amber-100 text-amber-600',
    questions: [
      {
        id: 'a-1',
        question: t('help.center.question.resetPassword'),
        answer: t('help.center.answer.signPageClickForgot'),
      },
      {
        id: 'a-2',
        question: t('help.center.question.changeEmailAddress'),
        answer: t('help.center.answer.contactSupportSupportFreeplug'),
      },
      {
        id: 'a-3',
        question: t('help.center.question.deleteAccount'),
        answer: t('help.center.answer.emailSupportFreeplugDev'),
      },
    ],
  },
]
}

function guidesFor(t: T, copy: LadderCopy) {
  const { HELP_PLANS_GUIDE_DESCRIPTION, HELP_PLANS_GUIDE_TITLE_LINE, STEP_BLURBS } = copy
  return [
  {
    id: 'guide-1',
    title: t('help.center.title.gettingFirstWebsite'),
    description: t('help.center.description.stepStepGuideRequesting'),
    icon: Globe,
    steps: [
      t('help.center.steps.createFreeplugAccount'),
      t('help.center.steps.completeBusinessProfile'),
      t('help.center.steps.submitWebsiteRequestRequirements'),
      t('help.center.steps.reviewApproveInitialDesign'),
      t('help.center.steps.provideFeedbackDuringDevelopment'),
      t('help.center.steps.launchWebsite'),
    ],
  },
  {
    id: 'guide-2',
    title: t('help.center.title.understandingDashboard'),
    description: t('help.center.description.learnNavigateUseAll'),
    icon: FileText,
    steps: [
      t('help.center.steps.overviewSeeWebsiteStatus'),
      HELP_PLANS_GUIDE_TITLE_LINE,
      t('help.center.steps.requestWebsiteSubmitUpdate'),
      t('help.center.steps.helpAccessFaqsGuides'),
    ],
  },
  {
    id: 'guide-3',
    title: t('help.center.title.choosingRightPlan'),
    description: HELP_PLANS_GUIDE_DESCRIPTION,
    icon: CreditCard,
    // Built from the ladder (PLACEHOLDER copy until Sable/Wren).
    steps: PLAN_STEPS.map((s) =>
      t(s.sellable ? 'help.center.planGuideStep' : 'help.center.planGuideStepComingSoon', { name: s.name, price: `$${s.monthlyCents / 100}`, blurb: STEP_BLURBS[s.id] })
    ),
  },
  {
    id: 'guide-4',
    title: t('help.center.title.preparingBrandAssets'),
    description: t('help.center.description.haveReadyBeforeRequesting'),
    icon: Palette,
    steps: [
      t('help.center.steps.logoFilesPngSvg'),
      t('help.center.steps.brandColorsHexCodes'),
      t('help.center.steps.businessDescriptionTagline'),
      t('help.center.steps.contactInformation'),
      t('help.center.steps.photosBusinessProductsTeam'),
      t('help.center.steps.examplesWebsitesLikePick'),
    ],
  },
]
}

export default function HelpPage() {
  const tr = useTranslations()
  const t: T = (key, values) => tr(key as never, values as never)
  const copy = useLadderCopy()
  const faqCategories = faqCategoriesFor(t, copy)
  const guides = guidesFor(t, copy)
  const [activeTab, setActiveTab] = useState<TabId>('faq')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('help.center.helpCenter')}</h1>
        <p className="text-gray-600 mt-1">{t('help.center.findAnswersGuidesSupportResources')}</p>
      </div>

      <div className="flex gap-2 border-b border-zinc-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#ba3d3d] text-[#ba3d3d]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {t(`help.center.label.${tab.label}`)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'faq' && (
          <motion.div
            key="faq"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {selectedCategory === null ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {faqCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 bg-white hover:border-[#ba3d3d]/30 hover:shadow-md transition-all text-left group"
                  >
                    <div className={`p-3 rounded-xl ${category.color}`}>
                      <category.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 group-hover:text-[#ba3d3d] transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('help.center.questionCount', { count: category.questions.length })}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#ba3d3d] transition-colors" />
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#ba3d3d] transition-colors mb-4"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  {t('help.center.backCategories')}
                </button>
                {(() => {
                  const category = faqCategories.find((c) => c.id === selectedCategory)
                  if (!category) return null
                  return (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`p-3 rounded-xl ${category.color}`}>
                          <category.icon className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{category.title}</h2>
                      </div>
                      <Accordion allowMultiple>
                        {category.questions.map((q) => (
                          <AccordionItem key={q.id} id={q.id}>
                            <AccordionTrigger id={q.id}>{q.question}</AccordionTrigger>
                            <AccordionContent id={q.id}>{q.answer}</AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )
                })()}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'guides' && (
          <motion.div
            key="guides"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid gap-4"
          >
            {guides.map((guide) => (
              <div
                key={guide.id}
                className="rounded-xl border border-zinc-200 bg-white p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-[#ba3d3d]/10">
                    <guide.icon className="w-5 h-5 text-[#ba3d3d]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{guide.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{guide.description}</p>
                    <ol className="space-y-2">
                      {guide.steps.map((step, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-gray-600">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium flex items-center justify-center">
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'contact' && (
          <motion.div
            key="contact"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('help.center.contactSupport')}</h2>
              <div className="space-y-4">
                <a
                  href="mailto:support@freeplug-in.dev"
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-50 transition-colors group"
                >
                  <div className="p-3 rounded-xl bg-blue-100">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 group-hover:text-[#ba3d3d] transition-colors">
                      {t('help.center.emailSupport')}
                    </p>
                    <p className="text-sm text-gray-500">support@freeplug-in.dev</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </a>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50">
                  <div className="p-3 rounded-xl bg-green-100">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{t('common.support.availabilityLabel')}</p>
                    <p className="text-sm text-gray-500">{t('common.support.availabilityLine')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50">
                  <div className="p-3 rounded-xl bg-purple-100">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{t('help.center.supportHours')}</p>
                    <p className="text-sm text-gray-500">{t('common.support.hours')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#ba3d3d]/20 bg-gradient-to-r from-[#ba3d3d]/5 to-[#8a2e2e]/5 p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-[#ba3d3d]/10">
                  <Shield className="w-5 h-5 text-[#ba3d3d]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{t('help.center.needUrgentHelp')}</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {t('help.center.criticalIssuesAffectingLiveWebsite')}
                  </p>
                  <a
                    href={`mailto:support@freeplug-in.dev?subject=${encodeURIComponent(t('help.center.urgentPrefillSubject'))}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ba3d3d] text-white text-sm font-medium hover:bg-[#a53434] transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {t('help.center.sendUrgentRequest')}
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
