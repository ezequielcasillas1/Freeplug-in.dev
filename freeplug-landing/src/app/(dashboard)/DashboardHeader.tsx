import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { signOut } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { LanguageToggleLink } from '@/components/i18n/LanguageToggleLink'
import { DASHBOARD_PICKER_PLACEMENT, type PickerPlacement } from './dashboard-chrome-placement'

/**
 * Signed-in header (dashboard layout). Below 640px the email is hidden so it can't run into the
 * logo, and "Sign out" never wraps (Lina, Sep 25). The language link sits just left of the account
 * controls (dashboard-chrome-placement.ts); it never wraps or truncates.
 */
export function DashboardHeader({
  email,
  pickerPlacement = DASHBOARD_PICKER_PLACEMENT,
}: {
  email: string | null | undefined
  pickerPlacement?: PickerPlacement
}) {
  const t = useTranslations('dashboard.nav')
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-4">
        <Link href="/" className="shrink-0 text-lg font-semibold text-[#ba3d3d]">
          {t('freeplug')}
        </Link>
        <nav className="flex min-w-0 items-center gap-2 sm:gap-4">
          <span
            className="hidden sm:block min-w-0 text-sm text-gray-600 truncate max-w-[200px]"
            data-testid="header-email"
          >
            {email}
          </span>
          {pickerPlacement === 'header' ? <LanguageToggleLink className="shrink-0" /> : null}
          <form action={signOut} className="shrink-0 flex items-center gap-2" data-testid="account-menu">
            {pickerPlacement === 'menu' ? <LanguageToggleLink className="shrink-0" /> : null}
            <Button type="submit" variant="secondary" size="sm" className="whitespace-nowrap">
              {t('signOut')}
            </Button>
          </form>
        </nav>
      </div>
    </header>
  )
}
