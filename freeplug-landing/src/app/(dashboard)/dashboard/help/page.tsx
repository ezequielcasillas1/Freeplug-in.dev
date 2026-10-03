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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  SUPPORT_AVAILABILITY_LABEL,
  SUPPORT_AVAILABILITY_LINE,
  SUPPORT_HOURS,
} from '@/lib/support-hours'

const tabs = [
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'guides', label: 'Guides', icon: Book },
  { id: 'contact', label: 'Contact', icon: Mail },
] as const

type TabId = (typeof tabs)[number]['id']

const faqCategories = [
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: Rocket,
    color: 'bg-blue-100 text-blue-600',
    questions: [
      {
        id: 'gs-1',
        question: 'How do I request a website?',
        answer:
          'Go to "Request website" in your dashboard. Fill out the form with your business details and what you need. Our team will review your request and contact you about next steps.',
      },
      {
        id: 'gs-2',
        question: 'What information do I need to provide?',
        answer:
          'You\'ll need your business name, description, contact information, and any branding materials (logo, colors) you have. The more details you provide about your vision, the better we can match your expectations.',
      },
      {
        id: 'gs-3',
        question: 'How long does the process take?',
        answer:
          'We\'ll give you a timeline after we review your request. The process includes the first design, your revisions, and launch. Most of the time depends on how quickly we get your details and approvals. We\'ll keep you updated along the way.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing and plans',
    icon: CreditCard,
    color: 'bg-green-100 text-green-600',
    questions: [
      {
        id: 'b-1',
        question: 'What are the hosting plan options?',
        answer:
          'Hosting is $35 to $100 per month. You can add one optional add-on. Basic (+$5/mo) includes regular backups and downtime alerts. Plus (+$10/mo) adds one small edit each month. Pro (+$15/mo) adds updates to your Google Business Profile. Each add-on includes everything in the one before it. See Plans in your dashboard for details.',
      },
      {
        id: 'b-2',
        question: 'How do I update my payment method?',
        answer:
          'Go to your dashboard and open Manage billing. After your first payment, you can manage your billing and payment method there.',
      },
      {
        id: 'b-3',
        question: 'Can I cancel my plan?',
        answer:
          'Yes, you can cancel at any time. Choose Cancel options in your dashboard. Your website stays online until the end of your paid period. If you want to keep your website, you can request a buyout quote.',
      },
      {
        id: 'b-4',
        question: 'Are there any hidden fees?',
        answer:
          "No. You pay for monthly hosting, which is required, plus any add-on you choose. One-time maintenance or a buyout costs extra only if you request it. Building your website is free, and you'll see the price before you pay.",
      },
      {
        id: 'b-5',
        question: 'How do I close my request or cancel my plan?',
        answer:
          'You can close a request from the request page (Dashboard, then View or update). If you have an active hosting plan, you\'ll need to cancel the plan first, because your site is still hosted under it and we don\'t want you charged for a request that\'s closed. To cancel, open Manage billing from your dashboard. Your plan stays active until the end of the current billing period. Once it has ended, you can close the request. Closing a request never cancels a plan on its own.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical support',
    icon: Settings,
    color: 'bg-purple-100 text-purple-600',
    questions: [
      {
        id: 't-1',
        question: 'Can I request changes to my website?',
        answer:
          'Yes. The Plus and Pro add-ons include one small edit each month. For other changes, request maintenance from your dashboard. Maintenance starts at $50, up to $100. You\'ll see the exact price before you pay.',
      },
      {
        id: 't-2',
        question: 'Is my website mobile-friendly?',
        answer:
          'Yes. Every site we build works on phones, tablets and computers, and we check it on each before launch.',
      },
      {
        id: 't-3',
        question: 'Do you help with SEO (search engine optimization)?',
        answer:
          'Every site includes the basics that help search engines read it: a page title and description for each page, clean page structure, and a mobile-friendly layout. We can\'t promise any search ranking.',
      },
      {
        id: 't-4',
        question: 'How secure is my website?',
        answer:
          'Every site includes an SSL certificate, so it loads over a secure https connection. Regular backups come with the Basic, Plus and Pro add-ons.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: User,
    color: 'bg-amber-100 text-amber-600',
    questions: [
      {
        id: 'a-1',
        question: 'How do I reset my password?',
        answer:
          'On the sign-in page, click "Forgot password?" and enter your email. We\'ll email you a link to set a new password. No email after a few minutes? Check your spam folder, or email support@freeplug-in.dev. If you sign in with Google, use "Continue with Google" instead.',
      },
      {
        id: 'a-2',
        question: 'Can I change my email address?',
        answer:
          'Contact support at support@freeplug-in.dev to request an email change. We\'ll confirm it\'s you, then update your account and let you know.',
      },
      {
        id: 'a-3',
        question: 'How do I delete my account?',
        answer:
          'Email support@freeplug-in.dev with your account deletion request. We\'ll delete it and email you when it\'s done. This can\'t be undone.',
      },
    ],
  },
]

const guides = [
  {
    id: 'guide-1',
    title: 'Getting your first website',
    description: 'Step-by-step guide to requesting and launching your business website',
    icon: Globe,
    steps: [
      'Create your Freeplug account',
      'Complete your business profile',
      'Submit a website request with your requirements',
      'Review and approve the initial design',
      'Provide feedback during development',
      'Launch your website',
    ],
  },
  {
    id: 'guide-2',
    title: 'Understanding your dashboard',
    description: 'Learn how to navigate and use all dashboard features',
    icon: FileText,
    steps: [
      'Overview: See your website status and quick actions',
      'Plans: Choose a hosting plan and add-on, or request maintenance',
      'Request website: Submit or update your website request',
      'Help: Access FAQs, guides, and contact support',
    ],
  },
  {
    id: 'guide-3',
    title: 'Choosing the right plan',
    description: 'Compare hosting amounts and add-ons for your business',
    icon: CreditCard,
    steps: [
      'Hosting: $35 to $100 per month',
      'Basic (+$5/mo): Regular backups and downtime alerts',
      'Plus (+$10/mo): Everything in Basic, plus one small edit each month',
      'Pro (+$15/mo): Everything in Plus, plus Google Business Profile updates',
    ],
  },
  {
    id: 'guide-4',
    title: 'Preparing your brand assets',
    description: 'What to have ready before requesting your website',
    icon: Palette,
    steps: [
      'Logo files (PNG, SVG preferred)',
      'Brand colors (hex codes if available)',
      'Business description and tagline',
      'Contact information',
      'Photos of your business, products, or team',
      'Examples of websites you like',
    ],
  },
]

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<TabId>('faq')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help center</h1>
        <p className="text-gray-600 mt-1">Find answers, guides, and support resources</p>
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
            {tab.label}
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
                        {category.questions.length} questions
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
                  Back to categories
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact support</h2>
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
                      Email support
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
                    <p className="font-medium text-gray-900">{SUPPORT_AVAILABILITY_LABEL}</p>
                    <p className="text-sm text-gray-500">{SUPPORT_AVAILABILITY_LINE}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50">
                  <div className="p-3 rounded-xl bg-purple-100">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Support hours</p>
                    <p className="text-sm text-gray-500">{SUPPORT_HOURS}</p>
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
                  <h3 className="font-semibold text-gray-900 mb-1">Need urgent help?</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    For critical issues affecting your live website, include &quot;URGENT&quot; in
                    your email subject line so it stands out in our inbox.
                  </p>
                  <a
                    href="mailto:support@freeplug-in.dev?subject=URGENT:%20"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ba3d3d] text-white text-sm font-medium hover:bg-[#a53434] transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Send urgent request
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
