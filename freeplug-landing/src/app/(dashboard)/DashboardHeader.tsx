import Link from 'next/link'
import { signOut } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'

/**
 * Signed-in header (dashboard layout). Below 640px the email is hidden so it can't run into the
 * logo, and "Sign out" never wraps (Lina, Sep 25).
 */
export function DashboardHeader({ email }: { email: string | null | undefined }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0 text-lg font-semibold text-[#ba3d3d]">
          Freeplug
        </Link>
        <nav className="flex min-w-0 items-center gap-4">
          <span
            className="hidden sm:block min-w-0 text-sm text-gray-600 truncate max-w-[200px]"
            data-testid="header-email"
          >
            {email}
          </span>
          <form action={signOut} className="shrink-0">
            <Button type="submit" variant="secondary" size="sm" className="whitespace-nowrap">
              Sign out
            </Button>
          </form>
        </nav>
      </div>
    </header>
  )
}
