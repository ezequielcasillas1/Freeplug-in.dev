'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { heroTextVariants, staggerContainer, fadeInUp } from '../animations/landing.variants'

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
      style={{
        background: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #f8e8e8 50%, #ba3d3d 150%)',
      }}
    >
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
      
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <motion.div variants={heroTextVariants} className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-medium">
            <Sparkles size={16} />
            Free Websites for Local Businesses
          </span>
        </motion.div>

        <motion.h1
          variants={heroTextVariants}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight"
        >
          Your Business Deserves
          <br />
          <span className="text-[#ba3d3d]">A Website</span>
        </motion.h1>

        <motion.p
          variants={heroTextVariants}
          className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10"
        >
          We build professional websites for local businesses at no charge.
          You only pay for hosting and maintenance.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" className="group">
            Get Free Website
            <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button variant="secondary" size="lg">
            Learn More
          </Button>
        </motion.div>

        <motion.p
          variants={fadeInUp}
          className="mt-6 text-sm text-gray-500"
        >
          *Terms and conditions apply. Create an account to view details.
        </motion.p>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}
