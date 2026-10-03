import Link from 'next/link'
import type { Metadata } from 'next'
import { requestPasswordReset } from '../actions'
import { Button } from '@/components/ui/button'
import { RESET_NEUTRAL_MESSAGE } from '@/lib/auth/password-reset'

export const metadata: Metadata = {
  title: 'Reset Your Password | Freeplug',
  robots: { index: false },
}

type Props = {
  searchParams: Promise<{ sent?: string; error?: string; reason?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const q = await searchParams

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot your password?</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter the email you use to sign in and we&apos;ll send you a link to set a new password.
      </p>

      {q.reason === 'reset-session' && q.sent !== '1' ? (
        <p className="mb-4 text-sm text-amber-700" role="alert">
          For your security, changing your password needs a fresh reset link. Enter your email and
          we&apos;ll send one.
        </p>
      ) : null}
      {q.error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {q.error}
        </p>
      ) : null}
      {q.sent === '1' ? (
        <p className="mb-4 text-sm text-green-700" role="status">
          {RESET_NEUTRAL_MESSAGE}
        </p>
      ) : null}

      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-[#ba3d3d] hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  )
}
