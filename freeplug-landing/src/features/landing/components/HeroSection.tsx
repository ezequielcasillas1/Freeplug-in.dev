'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Code, Zap, Palette, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { heroTextVariants, staggerContainer, fadeInUp, floatAnimation } from '../animations/landing.variants'
import { VideoScene } from './VideoScene'

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`
      backdrop-blur-xl bg-white/40 
      border border-white/60 
      shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]
      rounded-2xl
      ${className}
    `}>
      {children}
    </div>
  )
}

function FeaturePill({ icon: Icon, label }: { icon: typeof Code; label: string }) {
  return (
    <motion.div
      variants={floatAnimation}
      initial="initial"
      animate="animate"
      className="
        inline-flex items-center gap-2 px-4 py-2
        backdrop-blur-xl bg-white/50 
        border border-white/70
        shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]
        rounded-full
      "
    >
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] flex items-center justify-center shadow-sm">
        <Icon className="w-3 h-3 text-white" />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </motion.div>
  )
}

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 20%, #fef2f2 50%, #fce7f3 80%, #f5f3ff 100%)',
      }}
    >
      {/* Glassmorphism background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large glass orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br from-[#ba3d3d]/10 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-gradient-to-br from-purple-300/20 to-transparent blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 w-72 h-72 rounded-full bg-gradient-to-br from-pink-200/20 to-transparent blur-3xl" />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(186, 61, 61, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(186, 61, 61, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* 3D Character */}
      <VideoScene />

      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div variants={heroTextVariants}>
              <span className="
                inline-flex items-center gap-2 px-5 py-2.5 
                backdrop-blur-xl bg-white/60 
                border border-white/80
                shadow-[0_4px_24px_rgba(186,61,61,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]
                rounded-full text-[#ba3d3d] text-sm font-semibold
              ">
                <Sparkles size={16} className="animate-pulse" />
                Free Websites for Local Businesses
              </span>
            </motion.div>

            {/* Headline */}
            <motion.div variants={heroTextVariants} className="space-y-2">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight">
                Your Business
                <br />
                <span className="relative inline-block mt-1">
                  <span className="bg-gradient-to-r from-[#ba3d3d] via-[#c94a4a] to-[#8a2e2e] bg-clip-text text-transparent">
                    Deserves Better
                  </span>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 1, ease: 'easeOut' }}
                    className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-[#ba3d3d]/20 to-[#8a2e2e]/20 rounded-full origin-left"
                  />
                </span>
              </h1>
            </motion.div>

            {/* Description in glass card */}
            <motion.div variants={heroTextVariants}>
              <GlassCard className="p-6">
                <p className="text-gray-600 text-lg leading-relaxed">
                  We craft <span className="font-semibold text-gray-800">stunning, professional websites</span> for 
                  local businesses at <span className="font-bold text-[#ba3d3d]">absolutely no cost</span>. 
                  You only invest in hosting & maintenance.
                </p>
              </GlassCard>
            </motion.div>

            {/* Feature pills */}
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
              <FeaturePill icon={Code} label="Modern Tech" />
              <FeaturePill icon={Zap} label="Lightning Fast" />
              <FeaturePill icon={Palette} label="Custom Design" />
              <FeaturePill icon={Shield} label="Secure" />
            </motion.div>

            {/* CTA Buttons */}
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button 
                size="lg" 
                className="
                  group relative overflow-hidden
                  bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e]
                  shadow-[0_8px_32px_rgba(186,61,61,0.35)]
                  hover:shadow-[0_12px_40px_rgba(186,61,61,0.45)]
                  transition-all duration-300
                  text-base px-8
                "
              >
                <span className="relative z-10 flex items-center">
                  Get Your Free Website
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              <Button 
                variant="secondary" 
                size="lg" 
                className="
                  backdrop-blur-xl bg-white/70 
                  border border-white/80
                  shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]
                  hover:bg-white/90
                  text-gray-700 font-medium
                  text-base px-8
                "
              >
                See Our Work
              </Button>
            </motion.div>

            {/* Trust text */}
            <motion.p variants={fadeInUp} className="text-sm text-gray-500">
              No hidden fees • No contracts • Cancel anytime
            </motion.p>
          </motion.div>

          {/* Right side - empty for character positioning */}
          <div className="hidden lg:block" />
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white via-white/80 to-transparent z-30" />
    </section>
  )
}
