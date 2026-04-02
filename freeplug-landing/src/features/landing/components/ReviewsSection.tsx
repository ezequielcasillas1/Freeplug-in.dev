'use client'

import { motion } from 'framer-motion'
import { Star, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fadeInUp, staggerContainer, cardVariants } from '../animations/landing.variants'

const placeholderReviews = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
]

export function ReviewsSection() {
  return (
    <section id="reviews" className="py-24 bg-white">
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
            Testimonials
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4 mb-6"
          >
            What Our Clients Say
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Hear from local businesses who have partnered with us.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid md:grid-cols-3 gap-8 mb-12"
        >
          {placeholderReviews.map((review) => (
            <motion.div key={review.id} variants={cardVariants}>
              <Card className="h-full relative overflow-hidden">
                <CardContent className="pt-8">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-gray-200 fill-gray-200" />
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-100 rounded w-full" />
                    <div className="h-4 bg-gray-100 rounded w-5/6" />
                    <div className="h-4 bg-gray-100 rounded w-4/6" />
                  </div>
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                    <div className="w-10 h-10 bg-gray-100 rounded-full" />
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-24" />
                      <div className="h-2 bg-gray-100 rounded w-16" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 font-medium">Coming Soon</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-gray-500">
            Reviews will be available once we launch our first client websites.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
