'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

type Props = {
  label: string
  emailOptional: string
  emailPlaceholder: string
  errorGeneric: string
}

export function PersonalDownloadForm({ label, emailOptional, emailPlaceholder, errorGeneric }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/merch/personal-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? errorGeneric)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'freeplug-fonts-personal-demo.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="personal-font-email" className="block text-sm font-medium text-gray-700 mb-1">
          {emailOptional}
        </label>
        <input
          id="personal-font-email"
          type="email"
          autoComplete="email"
          placeholder={emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full min-h-11 rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba3d3d]/40"
        />
      </div>
      <Button
        type="button"
        size="lg"
        disabled={loading}
        onClick={() => void download()}
        className="w-full min-h-11 sm:w-auto sm:min-w-[12rem] bg-gray-900 hover:bg-gray-800 text-white"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <Download className="w-5 h-5" aria-hidden />}
        <span className="ml-2">{label}</span>
      </Button>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  )
}
