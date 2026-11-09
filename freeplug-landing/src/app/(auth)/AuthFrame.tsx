import { TranslationNotice } from '@/components/i18n/TranslationNotice'

/**
 * Centered card frame shared by the auth pages and the public sign-up page (/signup, /es/signup).
 * These pages have no landing footer, so the Spanish legal line (Aria 9:53) sits under the card.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-zinc-50">
      <div className="w-full max-w-md">
        {children}
        <TranslationNotice className="mt-6 text-center text-gray-500" />
      </div>
    </div>
  )
}
