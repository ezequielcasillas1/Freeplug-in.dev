'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
      >
        <motion.h2
          variants={fadeInUp}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
        >
          Ready to Get Your Free Website?
        </motion.h2>
        
        <motion.p
          variants={fadeInUp}
          className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto"
        >
          Join local businesses who trust Freeplug.dev to build their online presence. 
          No hidden fees, no surprises.
        </motion.p>
        
        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            size="lg"
            className="bg-white text-[#ba3d3d] hover:bg-gray-100 group"
          >
            Get Free Website
            <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/10 border border-white/30"
          >
            Contact Us
          </Button>
        </motion.div>
        
        <motion.div
          variants={fadeInUp}
          className="mt-8 flex items-center justify-center gap-2 text-white/60 text-sm"
        >
          <Shield size={16} />
          <span>Terms and conditions apply. Create an account to view full details.</span>
        </motion.div>
      </motion.div>
    </section>
  )
}
