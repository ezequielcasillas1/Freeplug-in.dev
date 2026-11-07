'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ShoppingBag } from 'lucide-react'

type Props = {
  label: string
  emailPlaceholder: string
  emailOptional: string
  errorGeneric: string
  mockNotice?: string
}

export function MerchCheckoutButton({ label, emailPlaceholder, emailOptional, errorGeneric, mockNotice }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mock, setMock] = useState(false)

  async function startCheckout() {
    setLoading(true)
    setError(null)
    setMock(false)
    try {
      const res = await fetch('/api/checkout/merch/font-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
      const data = (await res.json()) as { url?: string; error?: string; mock?: boolean }
      if (!res.ok || !data.url) {
        setError(data.error ?? errorGeneric)
        return
      }
      if (data.mock) setMock(true)
      window.location.href = data.url
    } catch {
      setError(errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="merch-email" className="block text-sm font-medium text-gray-700 mb-1">
          {emailOptional}
        </label>
        <input
          id="merch-email"
          type="email"
          autoComplete="email"
          placeholder={emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba3d3d]/40"
        />
      </div>
      <Button
        type="button"
        size="lg"
        disabled={loading}
        onClick={() => void startCheckout()}
        className="w-full sm:w-auto bg-[#ba3d3d] hover:bg-[#8a2e2e] text-white"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <ShoppingBag className="w-5 h-5" aria-hidden />}
        <span className="ml-2">{label}</span>
      </Button>
      {mock && mockNotice ? <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{mockNotice}</p> : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  )
}
