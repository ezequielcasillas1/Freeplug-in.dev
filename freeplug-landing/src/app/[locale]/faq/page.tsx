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
import { useTranslations } from 'next-intl'
import { useLadderCopy } from '@/lib/plans/use-ladder-copy'
import { SUPPORT_EMAIL } from '@/lib/site'
import { BookLiveSessionLink } from '@/components/booking/BookLiveSession'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'

/** Question/answer keys in display order; "what do I pay" and the buyout pair come from shared copy. */
const FAQ_KEYS = [
  { id: 'what-is-freeplug', q: 'public.faq.question.whatIsFreeplug', a: 'public.faq.answer.freeplugReachesLocalBusiness' },
  { id: 'is-it-free', q: 'public.faq.question.websiteReallyFree', a: 'public.faq.answer.yesWebsiteDevelopmentFree' },
  { id: 'what-do-i-pay', q: 'public.faq.question.monthlyPlanIncludes', a: null },
  { id: 'cancel-hosting', q: 'public.faq.question.happensCancelHosting', a: 'public.faq.answer.hostingRequiredKeepWebsite' },
  { id: 'buy-website', q: 'public.faq.question.howBuyoutWorks', a: 'buyout.faqAnswer' },
  { id: 'own-domain', q: 'public.faq.question.ownDomain', a: 'public.faq.answer.ownDomain' },
  { id: 'spanish-site', q: 'public.faq.question.spanishSite', a: 'public.faq.answer.spanishSite' },
  { id: 'booking-sites', q: 'public.faq.question.bookingSites', a: 'public.faq.answer.bookingSites' },
  { id: 'how-long', q: 'public.faq.question.longDoesTakeBuild', a: 'public.faq.answer.everySiteDifferentSo' },
  { id: 'get-started', q: 'public.faq.question.getStarted', a: 'public.faq.answer.createAccountFillOut' },
] as const

export default function FAQPage() {
  const t = useTranslations()
  const { HELP_WHAT_DO_I_PAY } = useLadderCopy()
  const faqs = FAQ_KEYS.map((f) => ({ id: f.id, question: t(f.q), answer: f.a ? t(f.a) : HELP_WHAT_DO_I_PAY }))
  // FAQPage JSON-LD built from the same strings shown on the page, so they always match.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
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
                {t('public.faq.helpCenter')}
              </motion.div>
              <motion.h1
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
              >
                {t.rich('public.faq.frequentlyAskedQuestions', {
                  span: (chunks) => (
                    <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">{chunks}</span>
                  ),
                })}
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-lg text-gray-600 max-w-xl mx-auto">
                {t('public.faq.answersCommonQuestionsAboutFreeplug')}
              </motion.p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="mb-12"
            >
              <Accordion allowMultiple>
                {faqs.map((faq) => (
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('public.faq.stillHaveQuestions')}</h3>
              <p className="text-gray-600 mb-4">
                {t('public.faq.wereHereHelpEmailSupport')}
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors"
              >
                {t('public.faq.contactSupport')}
                <ArrowRight className="w-4 h-4" />
              </a>
              <p className="text-gray-600 mt-4">
                {t('booking.faqLine')}{' '}
                <BookLiveSessionLink
                  label={t('booking.bookLiveSession')}
                  newTabHint={t('booking.opensInNewTab')}
                  className="font-medium text-[#ba3d3d] underline underline-offset-2 hover:text-[#9a3232]"
                />
              </p>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
