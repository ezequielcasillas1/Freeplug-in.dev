'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Code, Zap, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { heroTextVariants, staggerContainer, fadeInUp, floatAnimation, pulseGlow } from '../animations/landing.variants'
import { VideoScene } from './VideoScene'

function FloatingOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay }}
      className={className}
    >
      <motion.div
        variants={pulseGlow}
        initial="initial"
        animate="animate"
        className="w-full h-full rounded-full blur-3xl"
      />
    </motion.div>
  )
}

function FloatingCard({ icon: Icon, label, className, delay = 0 }: { 
  icon: typeof Code; 
  label: string; 
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateX: -20 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, delay }}
      className={className}
      style={{ perspective: '1000px' }}
    >
      <motion.div
        variants={floatAnimation}
        initial="initial"
        animate="animate"
        className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/10 p-4 border border-white/50"
        style={{ transformStyle: 'preserve-3d' }}
        whileHover={{ scale: 1.05, rotateY: 5 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{label}</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16 pb-8"
    >
      {/* Video Background */}
      <VideoScene />

      {/* Floating accent orbs */}
      <FloatingOrb 
        className="absolute top-20 left-10 w-72 h-72 bg-[#ba3d3d]/10" 
        delay={0.2}
      />
      <FloatingOrb 
        className="absolute bottom-20 right-10 w-96 h-96 bg-[#8a2e2e]/10" 
        delay={0.4}
      />

      <FloatingCard 
        icon={Code} 
        label="Clean Code" 
        className="absolute top-32 left-8 sm:left-16 lg:left-32 hidden md:block z-10"
        delay={0.8}
      />
      <FloatingCard 
        icon={Zap} 
        label="Fast Loading" 
        className="absolute top-48 right-8 sm:right-16 lg:right-32 hidden md:block z-10"
        delay={1}
      />
      <FloatingCard 
        icon={Palette} 
        label="Modern Design" 
        className="absolute bottom-48 left-8 sm:left-24 lg:left-48 hidden lg:block z-10"
        delay={1.2}
      />
      
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <motion.div variants={heroTextVariants} className="mb-6">
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/90 backdrop-blur-sm text-[#ba3d3d] text-sm font-medium shadow-lg shadow-[#ba3d3d]/10 border border-[#ba3d3d]/10">
            <Sparkles size={16} className="animate-pulse" />
            Free Websites for Local Businesses
          </span>
        </motion.div>

        <motion.h1
          variants={heroTextVariants}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight drop-shadow-sm"
        >
          Your Business Deserves
          <br />
          <span className="relative">
            <span className="relative z-10 bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
              A Beautiful Website
            </span>
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1, delay: 1 }}
              className="absolute bottom-2 left-0 h-3 bg-[#ba3d3d]/20 -z-0 rounded-full"
            />
          </span>
        </motion.h1>

        <motion.p
          variants={heroTextVariants}
          className="text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto mb-10 drop-shadow-sm"
        >
          We build professional, modern websites for local businesses at{' '}
          <span className="font-semibold text-[#ba3d3d]">no charge</span>.
          You only pay for hosting and maintenance.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" className="group shadow-lg shadow-[#ba3d3d]/30 hover:shadow-xl hover:shadow-[#ba3d3d]/40 transition-all">
            Get Free Website
            <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button variant="secondary" size="lg" className="backdrop-blur-sm bg-white/90 hover:bg-white">
            Learn More
          </Button>
        </motion.div>

        <motion.p
          variants={fadeInUp}
          className="mt-6 text-sm text-gray-600"
        >
          *Terms and conditions apply. Create an account to view details.
        </motion.p>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent z-10" />
    </section>
  )
}
