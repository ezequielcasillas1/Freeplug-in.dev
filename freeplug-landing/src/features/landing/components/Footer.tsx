'use client'

import { motion } from 'framer-motion'
import { fadeIn } from '../animations/landing.variants'

const footerLinks = {
  company: [
    { label: 'About', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'Reviews', href: '#reviews' },
  ],
  legal: [
    { label: 'Terms & Conditions', href: '#' },
    { label: 'Privacy Policy', href: '#' },
  ],
  contact: [
    { label: 'Get Started', href: '#' },
    { label: 'Support', href: '#' },
  ],
}

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <motion.footer
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="bg-gray-900 text-white py-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-1">
            <a href="#" className="flex items-center gap-2 mb-4">
              <span className="text-2xl font-bold text-[#ba3d3d]">Freeplug</span>
              <span className="text-2xl font-light text-white">.dev</span>
            </a>
            <p className="text-gray-400 text-sm">
              Free professional websites for local businesses. 
              You only pay for hosting and maintenance.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-3">
              {footerLinks.contact.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            &copy; {currentYear} Freeplug.dev. All rights reserved.
          </p>
          <p className="text-gray-500 text-xs">
            Built with love for local businesses
          </p>
        </div>
      </div>
    </motion.footer>
  )
}
