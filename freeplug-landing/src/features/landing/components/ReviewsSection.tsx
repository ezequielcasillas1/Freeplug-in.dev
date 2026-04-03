'use client'

import { motion } from 'framer-motion'
import { Star, MessageSquare, Quote, Clock, Users, Building } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fadeInUp, staggerContainer, cardVariants } from '../animations/landing.variants'

const placeholderReviews = [
  { id: 1, industry: 'Restaurant', gradient: 'from-orange-400 to-red-500' },
  { id: 2, industry: 'Retail Store', gradient: 'from-blue-400 to-indigo-500' },
  { id: 3, industry: 'Service Provider', gradient: 'from-green-400 to-emerald-500' },
]

const stats = [
  { icon: Users, value: '50+', label: 'Happy Clients' },
  { icon: Building, value: '100+', label: 'Websites Built' },
  { icon: Clock, value: '24/7', label: 'Support' },
]

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
          className="text-center mb-16"
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
            What Our{' '}
            <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
              Clients Say
            </span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Hear from local businesses who have partnered with us to transform their online presence.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-8 mb-16"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={cardVariants}
              className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-white shadow-lg border border-gray-100"
            >
              <div className="w-12 h-12 rounded-xl bg-[#ba3d3d]/10 flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-[#ba3d3d]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            </motion.div>
          ))}
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
              <Card className="h-full relative overflow-hidden border-0 shadow-lg bg-white group hover:shadow-xl transition-shadow duration-300">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${review.gradient}`} />
                <CardContent className="pt-8 relative">
                  <Quote className="w-10 h-10 text-[#ba3d3d]/20 absolute top-4 right-4" />
                  
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-gray-200 fill-gray-200" />
                    ))}
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full w-full animate-pulse" />
                    <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full w-5/6 animate-pulse" style={{ animationDelay: '0.1s' }} />
                    <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full w-4/6 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  </div>
                  
                  <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${review.gradient} opacity-30`} />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-gray-100 rounded-full w-24" />
                      <div className="h-3 bg-gray-50 rounded-full w-16" />
                    </div>
                    <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-full">
                      {review.industry}
                    </span>
                  </div>
                </CardContent>
                
                <motion.div 
                  initial={{ opacity: 1 }}
                  whileHover={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ba3d3d]/10 to-[#8a2e2e]/10 flex items-center justify-center mx-auto mb-3"
                    >
                      <MessageSquare className="w-8 h-8 text-[#ba3d3d]/50" />
                    </motion.div>
                    <p className="text-gray-500 font-medium">Coming Soon</p>
                    <p className="text-xs text-gray-400 mt-1">Hover to preview</p>
                  </div>
                </motion.div>
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
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-gray-600">
              <span className="font-semibold text-amber-700">Real reviews coming soon!</span>{' '}
              We&apos;re building amazing websites for our first clients.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
