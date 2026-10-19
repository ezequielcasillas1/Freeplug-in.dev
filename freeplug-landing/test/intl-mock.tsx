/**
 * Test stand-in for next-intl (Spanish build, Oct 4). Components and server code call
 * useTranslations / getTranslations as in the app, without a provider in every test. Messages are
 * the real catalogs: English by default, so existing word-for-word tests keep checking the English
 * lock (en.json). A test can switch to Spanish with setTestLocale('es') (draft catalog, missing keys
 * fall back to English like the local-QA override).
 */
import React from 'react'
import { createFormatter, createTranslator } from 'use-intl/core'
import { messagesFor, type Messages } from '@/i18n/messages'
import type { AppLocale } from '@/i18n/config'

type G = { __fpTestLocale?: AppLocale }
const g = globalThis as G

export function setTestLocale(locale: AppLocale) {
  g.__fpTestLocale = locale
}
export function testLocale(): AppLocale {
  return g.__fpTestLocale ?? 'en'
}
export function testMessages(locale: AppLocale = testLocale()): Messages {
  return messagesFor(locale, { FREEPLUG_I18N_ES_ALLOW_PENDING: '1' })
}

function translator(namespace?: string, locale: AppLocale = testLocale()) {
  return createTranslator({
    locale,
    messages: testMessages(locale),
    namespace: namespace as never,
    timeZone: 'America/Chicago',
  })
}

export const nextIntlMock = {
  useTranslations: (namespace?: string) => translator(namespace),
  useLocale: () => testLocale(),
  useMessages: () => testMessages(),
  useNow: () => new Date(),
  useTimeZone: () => 'America/Chicago',
  useFormatter: () => createFormatter({ locale: testLocale(), timeZone: 'America/Chicago' }),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  hasLocale: (locales: readonly string[], l: unknown) => typeof l === 'string' && locales.includes(l),
}

type NsArg = string | { locale?: string; namespace?: string } | undefined
const nsOf = (a: NsArg) => (typeof a === 'string' ? a : a?.namespace)
const localeOf = (a: NsArg): AppLocale => (typeof a === 'object' && a?.locale === 'es' ? 'es' : typeof a === 'object' && a?.locale === 'en' ? 'en' : testLocale())

export const nextIntlServerMock = {
  getTranslations: async (a?: NsArg) => translator(nsOf(a), localeOf(a)),
  getLocale: async () => testLocale(),
  getMessages: async () => testMessages(),
  getFormatter: async () => createFormatter({ locale: testLocale(), timeZone: 'America/Chicago' }),
  getNow: async () => new Date(),
  getTimeZone: async () => 'America/Chicago',
  setRequestLocale: () => {},
  getRequestConfig: (fn: unknown) => fn,
}

import NextLink from 'next/link'
import { localizedPath } from '@/i18n/routing'

/** Stand-in for src/i18n/navigation.ts (next-intl's createNavigation needs a provider). */
export const navigationMock = {
  LocalizedLink: ({ href, ...rest }: React.ComponentProps<typeof NextLink> & { href: string }) => {
    const [path, hash] = String(href).split('#')
    const target = path ? localizedPath(path, testLocale()) : ''
    return <NextLink href={hash !== undefined ? `${target}#${hash}` : target} {...rest} />
  },
  localizedRedirect: () => {
    throw new Error('localizedRedirect not available in tests')
  },
  useLocalizedPathname: () => '/',
  getPathname: ({ href }: { href: string }) => localizedPath(href, testLocale()),
}
