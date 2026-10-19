'use client'

import { motion } from 'framer-motion'
import { MessageCircle, Handshake, Building2, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fadeInUp, staggerContainer, cardVariants } from '../animations/landing.variants'
import { useTranslations } from 'next-intl'

const bullets = [
  {
    icon: MessageCircle,
    title: 'title.outreachOwnersWhoNeed',
    description: 'description.freeplugFindsLocalBusinesses',
  },
  {
    icon: Handshake,
    title: 'title.handOff72After',
    description: 'description.whenOwnerSaysYes',
  },
  {
    icon: Building2,
    title: 'title.monthlyHostingKeepsOnline',
    description: 'description.onceSiteLivePay',
  },
] as const // message keys under public.landing.about

export function AboutSection() {
  const t = useTranslations('public.landing.about')
  return (
    <section id="about" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4"
          >
            {t('aboutFreeplug')}
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6"
          >
            {t.rich('freeplugDoes', {
              span: (chunks) => (
                <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">{chunks}</span>
              ),
            })}
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed"
          >
            {t('freeplugOutreachSide')}
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid md:grid-cols-3 gap-8 mb-16"
        >
          {bullets.map((bullet) => (
            <motion.div key={bullet.title} variants={cardVariants}>
              <Card className="h-full text-left hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group overflow-hidden relative border-0 shadow-lg bg-white">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-10 pb-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                    <bullet.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{t(bullet.title)}</h3>
                  <p className="text-gray-600 leading-relaxed">{t(bullet.description)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-r from-[#ba3d3d]/10 to-[#8a2e2e]/10 border border-[#ba3d3d]/20 p-6 sm:p-8"
        >
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-[#ba3d3d]/15 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-[#ba3d3d]" />
            </div>
            <p className="text-gray-700 leading-relaxed">
              {t('freeplug72AfterWorkTogether')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
