import Link from 'next/link'
import { signIn } from '../actions'
import { Button } from '@/components/ui/button'

type Props = {
  searchParams: Promise<{ error?: string; next?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const q = await searchParams
  const next = q.next ?? '/dashboard'

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Log in</h1>
      <p className="text-sm text-gray-500 mb-6">
        Freeplug.dev account — hosting and dashboard access.
      </p>

      {q.error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {q.error}
        </p>
      ) : null}
      {q.message ? (
        <p className="mb-4 text-sm text-green-700" role="status">
          {q.message}
        </p>
      ) : null}

      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
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
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        No account?{' '}
        <Link href="/signup" className="font-medium text-[#ba3d3d] hover:underline">
          Create one
        </Link>
      </p>
      <p className="mt-3 text-center">
        <Link href="/" className="text-sm text-gray-500 hover:text-[#ba3d3d]">
          ← Back to site
        </Link>
      </p>
    </div>
  )
}
