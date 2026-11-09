import { getTranslations } from 'next-intl/server'
import { LanguageSelect } from '@/components/i18n/LanguageSelect'
import { spanishEnabled } from '@/i18n/gate'

/** Account settings. Today: the language row (Lina, Oct 10). */
export default async function SettingsPage() {
  const t = await getTranslations('dashboard.settings')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
      {spanishEnabled() ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <LanguageSelect />
        </section>
      ) : null}
    </div>
  )
}
