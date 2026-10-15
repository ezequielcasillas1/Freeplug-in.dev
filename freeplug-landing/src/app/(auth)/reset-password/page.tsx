import Link from 'next/link'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { updatePassword } from '../actions'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-reset'
import { RESET_COOKIE_NAME, resetCookieSecret, verifyResetToken } from '@/lib/auth/reset-cookie'

export const metadata: Metadata = {
  title: 'Set a New Password | Freeplug',
  robots: { index: false },
}

type Props = {
  searchParams: Promise<{ error?: string; expired?: string }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const q = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (q.expired !== '1') {
    // Only sessions that came from a reset link (signed 15-minute cookie for this user) may use
    // this page. Anyone else, including a normally signed-in user, is sent to request a link.
    const marker = (await cookies()).get(RESET_COOKIE_NAME)?.value
    if (!user || !verifyResetToken(marker, user.id, resetCookieSecret())) {
      redirect('/forgot-password?reason=reset-session')
    }
  }

  if (q.expired === '1' || !user) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset link expired</h1>
        <p className="mb-6 text-sm text-red-600" role="alert">
          This password reset link is invalid, has already been used, or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex w-full items-center justify-center rounded-lg bg-[#ba3d3d] px-4 py-3 font-medium text-white hover:bg-[#a33535] transition-colors"
        >
          Request a new reset link
        </Link>
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-[#ba3d3d] hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Set a new password</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choose a new password for {user.email ?? 'your account'}.
      </p>

      {q.error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {q.error}
        </p>
      ) : null}

      <form action={updatePassword} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">At least {PASSWORD_MIN_LENGTH} characters.</p>
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Save new password
        </Button>
      </form>
    </div>
  )
}
