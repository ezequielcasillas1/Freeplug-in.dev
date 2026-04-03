'use client'

import { motion } from 'framer-motion'
import { HelpCircle, ArrowRight } from 'lucide-react'
import { Navigation, Footer } from '@/features/landing'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'

const faqs = [
  {
    id: 'what-is-freeplug',
    question: 'What is Freeplug.dev?',
    answer:
      'Freeplug.dev is a service that provides free professional website development for local businesses. We believe every business deserves a strong online presence, regardless of their budget. Our team builds modern, responsive websites at no cost to help small businesses establish their digital footprint.',
  },
  {
    id: 'is-it-free',
    question: 'Is it really free?',
    answer:
      'Yes! Website development is completely free. We design and build your entire website at no charge. The only costs you may incur are for optional hosting and maintenance plans after your site is live. There are no hidden fees or surprise charges.',
  },
  {
    id: 'what-do-i-pay',
    question: 'What do I pay for?',
    answer:
      'You only pay for optional services: hosting (keeping your website online and accessible) and maintenance (updates, security patches, content changes). These are affordable monthly plans that ensure your website stays fast, secure, and up-to-date. Development itself is always free.',
  },
  {
    id: 'how-long',
    question: 'How long does it take to build my website?',
    answer:
      'Most websites are completed within 2-4 weeks, depending on complexity and your responsiveness with feedback. Simple sites can be ready in as little as 1 week, while more complex projects may take longer. We keep you updated throughout the entire process.',
  },
  {
    id: 'get-started',
    question: 'How do I get started?',
    answer:
      'Getting started is easy! Simply create an account, fill out our website request form describing your business and what you need, and our team will review your submission. Once approved, we\'ll reach out to discuss your project and begin the design process.',
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
                Help Center
              </motion.div>
              <motion.h1
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
              >
                Frequently Asked{' '}
                <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
                  Questions
                </span>
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-lg text-gray-600 max-w-xl mx-auto">
                Everything you need to know about Freeplug.dev and how we can help your business
                succeed online.
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
                We&apos;re here to help. Reach out to our support team anytime.
              </p>
              <a
                href="mailto:support@freeplug-in.dev"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors"
              >
                Contact Support
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
