'use client'

import { motion } from 'framer-motion'
import { HelpCircle, ArrowRight } from 'lucide-react'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { HELP_WHAT_DO_I_PAY } from '@/lib/plans/ladder-copy'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { BUYOUT_FAQ_ANSWER, BUYOUT_FAQ_QUESTION } from '@/lib/buyout/buyout'

const faqs = [
  {
    id: 'what-is-freeplug',
    question: 'What is Freeplug?',
    answer:
      'Freeplug reaches local business owners who need a website, and 72 After builds the site for free. We work in Central Texas: San Marcos, Kyle, New Braunfels, San Antonio, and Austin.',
  },
  {
    id: 'is-it-free',
    question: 'Is it really free?',
    answer:
      'Yes. Website development is free. 72 After designs and builds your website at no charge. After your site is live, you pay for monthly hosting, which is required. Maintenance or a buyout costs extra only if you ask for it. There are no hidden fees or surprise charges.',
  },
  {
    id: 'what-do-i-pay',
    question: 'What do I pay for?',
    // PLACEHOLDER (hosting ladder, src/lib/plans/ladder-copy.ts) until Sable's [STRICT] line.
    answer: HELP_WHAT_DO_I_PAY,
  },
  {
    id: 'cancel-hosting',
    question: 'What happens if I cancel hosting?',
    answer:
      'Hosting is required to keep your website online. You can cancel any time. Your website stays online until your paid period ends, then goes offline. If you sign up for hosting again, we bring it back.',
  },
  {
    id: 'buy-website',
    // Buyout (Sable, locked Sep 25 3:15 PM, revised 3:19 PM).
    question: BUYOUT_FAQ_QUESTION,
    answer: BUYOUT_FAQ_ANSWER,
  },
  {
    id: 'how-long',
    question: 'How long does it take to build my website?',
    answer:
      'Every site is different, so we\'ll give you a timeline after we review your request. Most of the time depends on how quickly we get your business details and approvals. We\'ll keep you updated along the way.',
  },
  {
    id: 'get-started',
    question: 'How do I get started?',
    answer:
      'Create an account and fill out the website request form. Tell us about your business and what you need. Our team will review your request. Once it\'s approved, we\'ll contact you to discuss your project and start the design.',
  },
]

export default function FAQPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
        <section className="py-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="text-center mb-12"
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4"
              >
                <HelpCircle className="w-4 h-4" />
                Help center
              </motion.div>
              <motion.h1
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
              >
                Frequently asked{' '}
                <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
                  questions
                </span>
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-lg text-gray-600 max-w-xl mx-auto">
                Answers to common questions about Freeplug and how it works.
              </motion.p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="mb-12"
            >
              <Accordion allowMultiple>
                {faqs.map((faq, index) => (
                  <motion.div key={faq.id} variants={fadeInUp}>
                    <AccordionItem id={faq.id}>
                      <AccordionTrigger id={faq.id}>{faq.question}</AccordionTrigger>
                      <AccordionContent id={faq.id}>{faq.answer}</AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="text-center p-8 rounded-2xl bg-gradient-to-r from-[#ba3d3d]/10 to-[#8a2e2e]/10 border border-[#ba3d3d]/20"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">Still have questions?</h3>
              <p className="text-gray-600 mb-4">
                We&apos;re here to help. Email our support team.
              </p>
              <a
                href="mailto:support@freeplug-in.dev"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors"
              >
                Contact support
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
