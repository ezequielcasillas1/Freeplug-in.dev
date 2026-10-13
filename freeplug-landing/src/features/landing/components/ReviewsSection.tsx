'use client'

import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'

export function ReviewsSection() {
  return (
    <section id="reviews" className="py-24 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-10"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4"
          >
            Testimonials
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6"
          >
            Reviews{' '}
            <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
              coming soon
            </span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            We&apos;ll share real owner feedback here once the first Freeplug / 72 After sites are live. No invented stats.
          </motion.p>
        </motion.div>

        {/* The three dummy placeholder review cards were removed (Wren R2/R3): no fake-looking
            testimonials until real owner reviews exist. */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-gray-600">
              <span className="font-semibold text-amber-700">Real reviews coming soon.</span>{' '}
              Freeplug is in early outreach — we won&apos;t invent client counts.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
