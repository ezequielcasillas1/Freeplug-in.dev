'use client'

import { motion } from 'framer-motion'
import { Heart, Mail, MapPin, ArrowUpRight } from 'lucide-react'
import { fadeIn, fadeInUp, staggerContainer } from '../animations/landing.variants'

const footerLinks = {
  company: [
    { label: 'About', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'Reviews', href: '#reviews' },
    { label: 'Plans', href: '#hosting-plans' },
  ],
  legal: [
    { label: 'Terms & Conditions', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
  contact: [
    { label: 'Get Started', href: '/signup' },
    { label: 'Support', href: 'mailto:support@freeplug-in.dev' },
    { label: 'FAQ', href: '/faq' },
  ],
}

const socialLinks = [
  { label: 'Twitter', href: '#' },
  { label: 'GitHub', href: '#' },
  { label: 'LinkedIn', href: '#' },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <motion.footer
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900 to-black" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[#ba3d3d]/50 to-transparent" />
      
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #ba3d3d 0%, transparent 50%)`,
        }} />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16"
        >
          <motion.div variants={fadeInUp} className="lg:col-span-2">
            <a href="#" className="flex items-center gap-2 mb-6 group">
              <span className="text-3xl font-bold text-[#ba3d3d] group-hover:text-[#d44d4d] transition-colors">Freeplug</span>
              <span className="text-3xl font-light text-white">.dev</span>
            </a>
            <p className="text-gray-400 leading-relaxed mb-6 max-w-sm">
              Empowering local businesses with professional websites at no cost. 
              Your success is our mission.
            </p>
            
            <div className="space-y-3">
              <a href="mailto:hello@freeplug.dev" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-[#ba3d3d]/20 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-sm">hello@freeplug.dev</span>
              </a>
              <div className="flex items-center gap-3 text-gray-400">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-sm">Supporting businesses worldwide</span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-semibold text-white mb-6 flex items-center gap-2">
              Company
              <span className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent" />
            </h4>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-semibold text-white mb-6 flex items-center gap-2">
              Legal
              <span className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent" />
            </h4>
            <ul className="space-y-4">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-semibold text-white mb-6 flex items-center gap-2">
              Get Started
              <span className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent" />
            </h4>
            <ul className="space-y-4">
              {footerLinks.contact.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
            
            <div className="mt-8">
              <p className="text-gray-500 text-xs mb-3">Follow us</p>
              <div className="flex gap-2">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="px-3 py-2 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#ba3d3d]/20 transition-all text-xs font-medium"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              &copy; {currentYear} Freeplug.dev. All rights reserved.
            </p>
            <p className="text-gray-600 text-sm flex items-center gap-2">
              Built with <Heart className="w-4 h-4 text-[#ba3d3d] fill-[#ba3d3d]" /> for local businesses
            </p>
          </div>
        </div>
      </div>
    </motion.footer>
  )
}
