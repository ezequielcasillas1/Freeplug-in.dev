'use client'

import { motion } from 'framer-motion'
import { Heart, Users, Globe, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fadeInUp, staggerContainer, cardVariants } from '../animations/landing.variants'

const values = [
  {
    icon: Heart,
    title: 'Our Mission',
    description: 'We help struggling local businesses get their first professional website, completely free of charge.',
  },
  {
    icon: Users,
    title: 'For Everyone',
    description: 'Whether you\'re just starting out or looking to expand, we\'re here for businesses at any level.',
  },
  {
    icon: Globe,
    title: 'Professional Quality',
    description: 'Every website we build meets modern standards with responsive design and fast performance.',
  },
]

const benefits = [
  'No upfront costs for website development',
  'Professional, modern design',
  'Mobile-responsive layouts',
  'Ongoing support and maintenance',
  'Easy content management',
  'SEO-friendly structure',
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeInUp}
            className="text-[#ba3d3d] font-semibold text-sm uppercase tracking-wider"
          >
            About Us
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4 mb-6"
          >
            Empowering Local Businesses
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Freeplug.dev was founded with a simple belief: every business deserves 
            a strong online presence, regardless of their budget.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid md:grid-cols-3 gap-8 mb-20"
        >
          {values.map((value) => (
            <motion.div key={value.title} variants={cardVariants}>
              <Card className="h-full text-center hover:shadow-xl transition-shadow">
                <CardContent className="pt-8">
                  <div className="w-14 h-14 bg-[#ba3d3d]/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                    <value.icon className="w-7 h-7 text-[#ba3d3d]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                  <p className="text-gray-600">{value.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] rounded-3xl p-8 sm:p-12"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div variants={fadeInUp}>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                What You Get
              </h3>
              <p className="text-white/80 mb-8">
                When you partner with Freeplug.dev, you receive a complete 
                professional website solution designed to help your business grow.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <motion.li
                    key={benefit}
                    variants={fadeInUp}
                    className="flex items-center gap-3 text-white"
                  >
                    <CheckCircle className="w-5 h-5 text-white/80 flex-shrink-0" />
                    <span>{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-2xl p-8 shadow-2xl"
            >
              <h4 className="text-xl font-bold text-gray-900 mb-4">
                Only Pay For
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <span className="text-gray-600">Hosting</span>
                  <span className="font-semibold text-[#ba3d3d]">Coming Soon</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <span className="text-gray-600">Maintenance</span>
                  <span className="font-semibold text-[#ba3d3d]">Coming Soon</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Website Development</span>
                  <span className="font-bold text-2xl text-[#ba3d3d]">$0</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
