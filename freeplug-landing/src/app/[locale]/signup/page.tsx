import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import { signUp, signInWithGoogle } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { isGoogleSignInEnabled } from '@/lib/auth/google-enabled'
import { ClaimStepLine } from '@/components/outreach/ClaimStepLine'
import { currentPreviewSite } from '@/lib/outreach/server'
import {
  CLAIMING_FOR_LINE,
  STEP1_BACK_LINK,
  STEP1_BUTTON,
  STEP1_HEADING,
  STEP1_SIGN_IN_LINK,
  STEP1_SIGN_IN_PROMPT,
  fill,
  step1Body,
} from '@/lib/outreach/copy'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'auth.signup' })
  const title = t('metaTitle')
  const description = t('metaDescription')
  return { title, description, ...publicAlternates('/signup', locale), openGraph: { title, description, type: 'website', ...ogLocale(locale) } }
}

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string; next?: string }>
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export default async function SignUpPage({ params, searchParams }: Props) {
  const q = await searchParams
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'auth.signup' })
  const es = locale === 'es'
  const google = await isGoogleSignInEnabled()
  // Claim mode (outreach step 1): only with next=/claim and a valid preview cookie.
  const claimSite = q.next === '/claim' ? await currentPreviewSite() : null
  const next = claimSite ? '/claim' : null

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
      {claimSite ? (
        <div className="mb-6 space-y-3">
          <ClaimStepLine step={1} locale={locale} />
          <p className="text-sm text-gray-500">
            {es ? t('claim.claimingFor', { name: claimSite.business_name }) : fill(CLAIMING_FOR_LINE, { 'Business Name': claimSite.business_name })}
          </p>
        </div>
      ) : null}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{claimSite ? (es ? t('claim.heading') : STEP1_HEADING) : t('heading')}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {claimSite ? (es ? t(claimSite.contact_email?.trim() ? 'claim.body' : 'claim.bodyNameOnly') : step1Body(claimSite.contact_email)) : t('subtitle')}
      </p>

      {q.error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {q.error}
        </p>
      ) : null}

      {/* Google: hidden when the Supabase Auth server has the provider off (local Docker stack) */}
      {google ? (
        <>
          {/* Google Sign Up */}
          <form action={signInWithGoogle} className="mb-6">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <button
              type="submit"
              className="w-full flex items-center justify-center px-4 py-3 border border-zinc-300 rounded-lg text-gray-700 bg-white hover:bg-zinc-50 font-medium transition-colors"
            >
              <GoogleIcon />
              {t('continueGoogle')}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t('or')}</span>
            </div>
          </div>
        </>
      ) : null}

      <form action={signUp} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {claimSite ? (
          <div>
            <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
              {t('businessName')}
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              maxLength={200}
              defaultValue={claimSite.business_name}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={claimSite?.contact_email ?? undefined}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            {t('confirmPassword')}
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] focus:border-[#ba3d3d] outline-none"
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          {claimSite ? (es ? t('claim.button') : STEP1_BUTTON) : t('signUp')}
        </Button>
      </form>

      {/* Claim mode wording (Sable 12:35 AM); the regular sign-up screen is unchanged. */}
      <p className="mt-6 text-center text-sm text-gray-600">
        {claimSite ? (es ? t('claim.signInPrompt') : STEP1_SIGN_IN_PROMPT) : t('SignUpPage.alreadyHaveAccount')}{' '}
        <Link href={next ? '/login?next=/claim' : '/login'} className="font-medium text-[#ba3d3d] hover:underline">
          {claimSite ? (es ? t('claim.signInLink') : STEP1_SIGN_IN_LINK) : t('logIn')}
        </Link>
      </p>
      <p className="mt-3 text-center">
        <Link href={claimSite ? '/preview' : '/'} className="text-sm text-gray-500 hover:text-[#ba3d3d]">
          ← {claimSite ? (es ? t('claim.backLink') : STEP1_BACK_LINK) : t('backSite')}
        </Link>
      </p>
    </div>
  )
}
