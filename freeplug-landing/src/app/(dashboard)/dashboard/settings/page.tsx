import { getTranslations } from 'next-intl/server'
import { SettingsAccountSection } from './SettingsAccountSection'
import { LanguageSelect } from '@/components/i18n/LanguageSelect'
import { spanishEnabled } from '@/i18n/gate'
import { createClient } from '@/lib/supabase/server'

/**
 * Account settings. Language row (Lina, Oct 10) only while the Spanish gate is on. The account row
 * is always shown (Oct 30): with the gate off the page used to render just the heading.
 */
export default async function SettingsPage() {
  const t = await getTranslations('dashboard.settings')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
      <SettingsAccountSection
        email={user?.email ?? null}
        heading={t('account.heading')}
        emailLabel={t('account.emailLabel')}
        help={t('account.help')}
        helpLink={t('account.helpLink')}
      />
      {spanishEnabled() ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <LanguageSelect />
        </section>
      ) : null}
    </div>
  )
}
