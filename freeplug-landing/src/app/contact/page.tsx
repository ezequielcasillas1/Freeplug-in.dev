'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Send } from 'lucide-react'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { Turnstile } from '@/components/turnstile/Turnstile'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { CONTACT_ERROR, CONTACT_LIMITS } from '@/lib/contact/contact'
import { sendContactAction } from './actions'

const field =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-[#ba3d3d] focus:outline-none focus:ring-2 focus:ring-[#ba3d3d]/20'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' })
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      const res = await sendContactAction(form, token)
      if (res.ok) {
        setSuccess(res.message)
        setStatus('sent')
        return
      }
      setError(res.error)
    } catch {
      setError(CONTACT_ERROR)
    }
    setStatus('idle')
    setToken(null)
    setResetKey((k) => k + 1)
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
        <section className="py-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="text-center mb-10">
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4"
              >
                <Mail className="w-4 h-4" />
                Contact
              </motion.div>
              <motion.h1 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Get in{' '}
                <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">touch</span>
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-lg text-gray-600">
                Send us a message and we&apos;ll reply by email.
              </motion.p>
            </motion.div>

            <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="p-8 rounded-2xl bg-white border border-gray-100 shadow-sm">
              {status === 'sent' ? (
                <p role="status" className="text-center text-gray-700">{success}</p>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
                  <p className="text-sm font-semibold text-gray-900">
                    <span className="text-[#ba3d3d]">IQC:</span> inquiries, questions, and concerns
                  </p>
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input id="contact-name" required maxLength={CONTACT_LIMITS.name} autoComplete="name" value={form.name} onChange={set('name')} className={field} />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input id="contact-email" type="email" required maxLength={CONTACT_LIMITS.email} autoComplete="email" value={form.email} onChange={set('email')} className={field} />
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea id="contact-message" required rows={6} minLength={CONTACT_LIMITS.messageMin} maxLength={CONTACT_LIMITS.message} value={form.message} onChange={set('message')} className={field} />
                  </div>
                  {/* Honeypot: hidden from people, bots fill it. */}
                  <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
                    <label htmlFor="contact-website">Website</label>
                    <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                  </div>
                  <Turnstile onToken={setToken} resetKey={resetKey} />
                  {error && <p role="alert" className="text-sm text-[#ba3d3d]">{error}</p>}
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors disabled:opacity-60"
                  >
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
