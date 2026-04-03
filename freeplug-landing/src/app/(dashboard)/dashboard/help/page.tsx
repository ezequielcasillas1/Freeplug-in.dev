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

const tabs = [
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'guides', label: 'Guides', icon: Book },
  { id: 'contact', label: 'Contact', icon: Mail },
] as const

type TabId = (typeof tabs)[number]['id']

const faqCategories = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    color: 'bg-blue-100 text-blue-600',
    questions: [
      {
        id: 'gs-1',
        question: 'How do I request a website?',
        answer:
          'Navigate to the "Request Website" section in your dashboard. Fill out the form with your business details, design preferences, and any specific requirements. Our team will review your request and get back to you within 2-3 business days.',
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
          'Typical timeline is 2-4 weeks from approval to launch. This includes initial design, revisions, and final deployment. Complex projects may take longer, but we\'ll keep you informed throughout.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Plans',
    icon: CreditCard,
    color: 'bg-green-100 text-green-600',
    questions: [
      {
        id: 'b-1',
        question: 'What are the hosting plan options?',
        answer:
          'We offer flexible hosting plans starting from basic shared hosting to premium dedicated options. Each plan includes SSL certificates, regular backups, and uptime monitoring. View our Plans page for detailed pricing.',
      },
      {
        id: 'b-2',
        question: 'How do I update my payment method?',
        answer:
          'Go to Dashboard > Plans to manage your subscription and payment details. You can update your card, view billing history, and change plans at any time.',
      },
      {
        id: 'b-3',
        question: 'Can I cancel my subscription?',
        answer:
          'Yes, you can cancel anytime from the Plans section. Your website will remain active until the end of your current billing period. We\'ll help you export your data if needed.',
      },
      {
        id: 'b-4',
        question: 'Are there any hidden fees?',
        answer:
          'No hidden fees ever. You only pay for the hosting/maintenance plan you choose. Website development is always free, and we\'re transparent about all costs upfront.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical Support',
    icon: Settings,
    color: 'bg-purple-100 text-purple-600',
    questions: [
      {
        id: 't-1',
        question: 'Can I request changes to my website?',
        answer:
          'Yes! Minor content updates are included in maintenance plans. For larger changes or new features, submit a change request through your dashboard and we\'ll provide a timeline.',
      },
      {
        id: 't-2',
        question: 'Is my website mobile-friendly?',
        answer:
          'All websites we build are fully responsive and optimized for mobile devices, tablets, and desktops. We test across multiple browsers and screen sizes.',
      },
      {
        id: 't-3',
        question: 'Do you provide SEO optimization?',
        answer:
          'Yes, every website includes basic SEO setup: proper meta tags, semantic HTML, fast loading times, and mobile optimization. Advanced SEO services are available upon request.',
      },
      {
        id: 't-4',
        question: 'How secure is my website?',
        answer:
          'Security is a priority. All sites include SSL certificates, regular security updates, and protection against common vulnerabilities. We also perform regular backups.',
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
          'Click "Forgot Password" on the login page and enter your email. You\'ll receive a reset link within minutes. If you don\'t see it, check your spam folder.',
      },
      {
        id: 'a-2',
        question: 'Can I change my email address?',
        answer:
          'Contact support at support@freeplug-in.dev to request an email change. We\'ll verify your identity and update your account within 24 hours.',
      },
      {
        id: 'a-3',
        question: 'How do I delete my account?',
        answer:
          'Email support@freeplug-in.dev with your account deletion request. We\'ll process it within 7 days and provide confirmation. Note: this action is irreversible.',
      },
    ],
  },
]

const guides = [
  {
    id: 'guide-1',
    title: 'Getting Your First Website',
    description: 'Step-by-step guide to requesting and launching your business website',
    icon: Globe,
    steps: [
      'Create your Freeplug.dev account',
      'Complete your business profile',
      'Submit a website request with your requirements',
      'Review and approve the initial design',
      'Provide feedback during development',
      'Launch your website!',
    ],
  },
  {
    id: 'guide-2',
    title: 'Understanding Your Dashboard',
    description: 'Learn how to navigate and use all dashboard features',
    icon: FileText,
    steps: [
      'Overview: See your website status and quick actions',
      'Plans: Manage hosting and maintenance subscriptions',
      'Request Website: Submit new website requests',
      'Help: Access FAQs, guides, and contact support',
    ],
  },
  {
    id: 'guide-3',
    title: 'Choosing the Right Plan',
    description: 'Compare hosting plans and find the best fit for your business',
    icon: CreditCard,
    steps: [
      'Starter: Basic hosting for small sites with low traffic',
      'Professional: Enhanced performance and priority support',
      'Business: Advanced features, custom domain, and dedicated resources',
      'Consider your traffic, features needed, and budget',
    ],
  },
  {
    id: 'guide-4',
    title: 'Preparing Your Brand Assets',
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
        <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Support</h2>
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
                      Email Support
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
                    <p className="font-medium text-gray-900">Response Time</p>
                    <p className="text-sm text-gray-500">Usually within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50">
                  <div className="p-3 rounded-xl bg-purple-100">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Support Hours</p>
                    <p className="text-sm text-gray-500">Monday - Friday, 9am - 6pm EST</p>
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
                  <h3 className="font-semibold text-gray-900 mb-1">Need Urgent Help?</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    For critical issues affecting your live website, please include
                    &quot;URGENT&quot; in your email subject line for priority handling.
                  </p>
                  <a
                    href="mailto:support@freeplug-in.dev?subject=URGENT:%20"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ba3d3d] text-white text-sm font-medium hover:bg-[#a53434] transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Send Urgent Request
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
