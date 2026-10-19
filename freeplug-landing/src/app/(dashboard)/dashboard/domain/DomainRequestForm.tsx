'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { requestDomainSetup } from './actions'
import { BUY_FOR_ME_CONSENT, CONSENT_REQUIRED, DOMAIN_INVALID, DOMAIN_KINDS, offerActive, offerSpotsLeft, type DomainKind, type DomainOfferStatus } from '@/lib/domain/flow'

const INPUT =
  'mt-1 block w-full rounded-lg border border-[#d9c8b6] px-3 py-2.5 text-[15px] font-normal text-gray-900 outline-none focus:ring-2 focus:ring-[#c2643a]'
const FIELD = 'mt-3 block text-sm font-semibold text-[#3a2e26]'
const HELP = 'mt-1 block text-[13px] font-normal text-[#9a8676]'

export function DomainRequestForm({ freeplugUrl, offer = null }: { freeplugUrl?: string | null; offer?: DomainOfferStatus | null }) {
  const t = useTranslations('domainFlow')
  const locale = useLocale() === 'es' ? 'es' : 'en'
  const [kind, setKind] = useState<DomainKind>('have_domain')
  const [domain, setDomain] = useState('')
  const [registrar, setRegistrar] = useState('')
  const [backup, setBackup] = useState('')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const blocked = kind === 'buy_for_me' && !consent
  const label: Record<DomainKind, string> = { have_domain: t('have.label'), buy_for_me: t('buy.label'), buy_self: t('self.label') }
  const helper: Record<DomainKind, string> = { have_domain: t('have.helper'), buy_for_me: t('buy.helper'), buy_self: t('self.helper') }
  if (done) return <p className="text-sm font-medium text-gray-800" role="status">{t('savedNote')}</p>
  return (
    <form
      className="text-[#3a2e26]"
      onSubmit={async (e) => {
        e.preventDefault()
        if (blocked) return
        setPending(true)
        setError(null)
        const input =
          kind === 'have_domain'
            ? { kind, domain, registrar }
            : kind === 'buy_for_me'
              ? { kind, domain, backupDomain: backup, consent }
              : { kind }
        const res = await requestDomainSetup(input)
        setPending(false)
        if (res.ok) {
          setDone(true)
        } else setError(res.error === DOMAIN_INVALID ? t('errors.domainInvalid') : res.error === CONSENT_REQUIRED ? t('errors.consentRequired') : t('errors.tryAgain'))
      }}
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">{t('title')}</legend>
        {DOMAIN_KINDS.map((k) => (
          <div key={k} data-kind={k} className={`rounded-xl bg-white p-3.5 ${kind === k ? 'border-2 border-[#c2643a]' : 'border border-[#e5d6c6]'}`}>
            <label className="flex cursor-pointer items-start gap-2">
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => { setKind(k); setError(null) }} className="mt-1 accent-[#c2643a]" />
              <span>
                <span className="text-base font-semibold">
                  {label[k]}
                  {k === 'buy_for_me' ? (
                    <span className="ml-1.5 inline-block rounded border border-[#fde68a] bg-[#fef3c7] px-1.5 align-[2px] text-[11px] font-bold tracking-wide text-[#92400e]">{t('buy.beta')}</span>
                  ) : null}
                </span>
                <span className="block text-sm text-[#5a4637]">{helper[k]}</span>
                {k === 'buy_for_me' && offer ? (
                  offerActive(offer) ? (
                    <span className="mt-1 block text-sm font-medium text-[#2f6b3a]" data-testid="domain-offer">
                      {t('buy.offerIncluded', { cap: offer.cap })} {t('buy.offerSpotsLeft', { count: offerSpotsLeft(offer) })}
                    </span>
                  ) : (
                    <span className="mt-1 block text-sm text-[#9a8676]" data-testid="domain-offer-ended">
                      {t('buy.offerEnded', { cap: offer.cap })}
                    </span>
                  )
                ) : null}
              </span>
            </label>
            {kind === k && k === 'have_domain' ? (
              <div className="pl-6">
                <label className={FIELD}>
                  {t('have.domain')}
                  <input className={INPUT} placeholder="yourbusiness.com" value={domain} onChange={(e) => setDomain(e.target.value)} required maxLength={253} autoComplete="off" />
                </label>
                <label className={FIELD}>
                  {t('have.registrar')}
                  <input className={INPUT} placeholder={t('have.registrarPlaceholder')} value={registrar} onChange={(e) => setRegistrar(e.target.value)} maxLength={100} autoComplete="off" />
                  <span className={HELP}>{t('have.registrarHelp')}</span>
                </label>
              </div>
            ) : null}
            {kind === k && k === 'buy_for_me' ? (
              <div className="pl-6">
                <label className={FIELD}>
                  {t('buy.domain')}
                  <input className={INPUT} placeholder="yourbusiness.com" value={domain} onChange={(e) => setDomain(e.target.value)} required maxLength={253} autoComplete="off" />
                </label>
                <label className={FIELD}>
                  {t('buy.backup')}
                  <input className={INPUT} placeholder="yourbusinesstx.com" value={backup} onChange={(e) => setBackup(e.target.value)} maxLength={253} autoComplete="off" />
                  <span className={HELP}>{t('buy.backupHelp')}</span>
                </label>
                <div className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[13px] leading-snug text-[#5a4637]">
                  <b className="text-[#92400e]">{t('buy.betaLead')}</b> {t('buy.betaNote')}
                </div>
                <label className="mt-3 flex items-start gap-2.5 text-sm">
                  <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[#c2643a]" />
                  <span>
                    {BUY_FOR_ME_CONSENT[locale]} <span className="text-[#9a8676]">{t('buy.consentRequired')}</span>
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={pending || blocked}
        className="mt-4 w-full rounded-[10px] bg-[#c2643a] p-3.5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '…' : t('save')}
      </button>
      <p className="mt-2.5 text-center text-[13px] text-[#9a8676]">{t('keepsWorking', { url: freeplugUrl || t('freeUrlFallback') })}</p>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
