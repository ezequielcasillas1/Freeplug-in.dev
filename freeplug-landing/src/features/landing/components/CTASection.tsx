'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Shield, Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'

const highlights = [
  'Free website development',
  'No hidden fees',
  '24/7 support',
]

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#ba3d3d] via-[#a53434] to-[#8a2e2e]" />
      
      <div className="absolute inset-0">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/10 rounded-full blur-3xl"
        />
      </div>
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />
      </div>
      
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
      >
        <motion.div
          variants={fadeInUp}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium border border-white/20">
            <Sparkles size={16} className="animate-pulse" />
            Limited Time Offer
          </span>
        </motion.div>
        
        <motion.h2
          variants={fadeInUp}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6"
        >
          Ready to Get Your{' '}
          <span className="relative inline-block">
            <span className="relative z-10">Free Website?</span>
            <motion.span
              initial={{ width: 0 }}
              whileInView={{ width: '100%' }}
              transition={{ duration: 0.8, delay: 0.5 }}
              viewport={{ once: true }}
              className="absolute bottom-2 left-0 h-3 bg-white/20 rounded-full"
            />
          </span>
        </motion.h2>
        
        <motion.p
          variants={fadeInUp}
          className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto"
        >
          Join local businesses who trust Freeplug.dev to build their online presence. 
          No hidden fees, no surprises.
        </motion.p>
        
        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-10"
        >
          {highlights.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              viewport={{ once: true }}
              className="flex items-center gap-2 text-white/90"
            >
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
              <span className="text-sm font-medium">{item}</span>
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            size="lg"
            className="bg-white text-[#ba3d3d] hover:bg-gray-100 group shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all px-8"
          >
            Get Free Website
            <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/10 border border-white/30 backdrop-blur-sm"
          >
            Contact Us
          </Button>
        </motion.div>
        
        <motion.div
          variants={fadeInUp}
          className="mt-10 flex items-center justify-center gap-2 text-white/60 text-sm"
        >
          <Shield size={16} />
          <span>Terms and conditions apply. Create an account to view full details.</span>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 1 }}
          viewport={{ once: true }}
          className="mt-12 flex flex-wrap justify-center gap-8"
        >
          {['Trusted by 50+ businesses', '4.9/5 satisfaction', 'Fast delivery'].map((stat, index) => (
            <div key={stat} className="text-white/40 text-sm">
              {stat}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}
