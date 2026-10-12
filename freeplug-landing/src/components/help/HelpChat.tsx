'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useLadderCopy } from '@/lib/plans/use-ladder-copy'
import { useTranslations } from 'next-intl'
import { CHANGE_TYPES, helpChatContent, type ChangeType } from '@/lib/help/help-chat-content'
import { SUPPORT_EMAIL } from '@/lib/site'
import type {
  HelpChangeRequestInput,
  HelpChangeRequestResult,
} from '@/app/(dashboard)/dashboard/request-website/actions'

type Props = {
  email: string
  /** Plan includes a small edit (Fast lane and up, or a grandfathered Plus/Pro add-on): shows the included-edit note. */
  /** Plan includes the small edit this period (getEntitlements().includedEditsPerMonth > 0). */
  hasIncludedEdit: boolean
  /** Starter without the +1 small edit add-on: Sable's line pointing to the add-on (starterSmallEditAddonLine). */
  smallEditAddonNote?: string | null
  sendRequest: (input: HelpChangeRequestInput) => Promise<HelpChangeRequestResult>
}

type Step = 'menu' | 1 | 2 | 3 | 4 | 'review' | 'sent'

type Draft = {
  changeType: ChangeType | null
  page: string
  description: string
  photo: File | null
}

const EMPTY_DRAFT: Draft = { changeType: null, page: '', description: '', photo: null }

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none'

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-3 text-sm text-gray-800">
      {children}
    </div>
  )
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-auto max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-tr-sm bg-[#ba3d3d] px-4 py-3 text-sm text-white">
      {children}
    </div>
  )
}

export function HelpChat({ email, hasIncludedEdit, smallEditAddonNote = null, sendRequest }: Props) {
  const ladder = useLadderCopy()
  const { GO_TO_PLANS } = ladder
  const tr = useTranslations()
  // Server-resolved messages (useTranslations reads the provider), so the chat follows the page's language.
  const H = helpChatContent((key, values) => tr(key as never, values as never), ladder)
  const C = H.copy
  const HELP_QUICK_QUESTIONS = H.quickQuestions
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('menu')
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')
  const [pending, startTransition] = useTransition()

  const openQuestion = HELP_QUICK_QUESTIONS.find((q) => q.id === openQuestionId) ?? null
  const inFlow = step !== 'menu'

  function startChange() {
    setOpenQuestionId(null)
    setError(null)
    setStep(1)
  }

  function send() {
    if (!draft.changeType) return
    setError(null)
    startTransition(async () => {
      const r = await sendRequest({
        changeType: draft.changeType as ChangeType,
        page: draft.page,
        description: draft.description,
        photoName: draft.photo?.name,
      })
      if (r.ok) {
        setSentTo(r.email || email)
        setStep('sent')
      } else {
        setError(r.error)
      }
    })
  }

  return (
    <section
      aria-label={H.ariaLabel}
      className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-sm"
    >
      <div className="space-y-3">
        <BotBubble>{H.greeting}</BotBubble>

        {openQuestion ? (
          <>
            <UserBubble>{openQuestion.question}</UserBubble>
            <BotBubble>{openQuestion.answer}</BotBubble>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <BotBubble>{C.step1}</BotBubble>
            <div className="flex flex-wrap gap-2">
              {CHANGE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({ ...d, changeType: t }))
                    setStep(2)
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    draft.changeType === t
                      ? 'border-[#ba3d3d] bg-[#ba3d3d] text-white'
                      : 'border-zinc-300 text-gray-700 hover:border-[#ba3d3d] hover:text-[#ba3d3d]'
                  }`}
                >
                  {H.changeTypeLabel[t]}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 || step === 3 || step === 4 ? (
          <UserBubble>{draft.changeType ? H.changeTypeLabel[draft.changeType] : null}</UserBubble>
        ) : null}

        {step === 2 ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.page.trim()) setStep(3)
            }}
          >
            <BotBubble>
              <label htmlFor="help-change-page">{C.step2}</label>
            </BotBubble>
            <input
              id="help-change-page"
              className={inputClass}
              placeholder={C.step2Placeholder}
              maxLength={200}
              required
              autoFocus
              value={draft.page}
              onChange={(e) => setDraft((d) => ({ ...d, page: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
                {H.back}
              </Button>
              <Button type="submit" size="sm" disabled={!draft.page.trim()}>
                {H.next}
              </Button>
            </div>
          </form>
        ) : null}

        {step === 3 || step === 4 ? <UserBubble>{draft.page}</UserBubble> : null}

        {step === 3 ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.description.trim()) setStep(4)
            }}
          >
            <BotBubble>
              <label htmlFor="help-change-description">{C.step3}</label>
            </BotBubble>
            <textarea
              id="help-change-description"
              className={`${inputClass} resize-y`}
              rows={4}
              placeholder={C.step3Placeholder}
              maxLength={2000}
              required
              autoFocus
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(2)}>
                {H.back}
              </Button>
              <Button type="submit" size="sm" disabled={!draft.description.trim()}>
                {H.next}
              </Button>
            </div>
          </form>
        ) : null}

        {step === 4 ? (
          <>
            <UserBubble>{draft.description}</UserBubble>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                setStep('review')
              }}
            >
              <BotBubble>
                <label htmlFor="help-change-photo">{C.step4}</label>
              </BotBubble>
              <input
                id="help-change-photo"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-200"
                onChange={(e) => setDraft((d) => ({ ...d, photo: e.target.files?.[0] ?? null }))}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setStep(3)}>
                  {H.back}
                </Button>
                <Button type="submit" size="sm">
                  {H.next}
                </Button>
              </div>
            </form>
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <BotBubble>
              <p>{C.review}</p>
              {hasIncludedEdit ? (
                <p className="mt-2">{C.includedEditNote}</p>
              ) : smallEditAddonNote ? (
                <p className="mt-2" data-testid="small-edit-addon-note">
                  {smallEditAddonNote}{' '}
                  {/* Sable, Oct 4 9:05: a "Go to Plans" link after the small-edit line. */}
                  <Link href="/dashboard/plans" className="font-medium text-[#ba3d3d] underline underline-offset-2" data-testid="small-edit-addon-plans-link">
                    {GO_TO_PLANS}
                  </Link>
                </p>
              ) : null}
            </BotBubble>
            <dl className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm space-y-2">
              <div>
                <dt className="text-gray-500">{C.step1}</dt>
                <dd className="text-gray-900">{draft.changeType ? H.changeTypeLabel[draft.changeType] : null}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{C.step2}</dt>
                <dd className="text-gray-900 break-words">{draft.page}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{C.step3}</dt>
                <dd className="text-gray-900 whitespace-pre-wrap break-words">
                  {draft.description}
                </dd>
              </div>
              {draft.photo ? (
                <div>
                  <dt className="text-gray-500">{C.step4}</dt>
                  <dd className="text-gray-900 break-all">{draft.photo.name}</dd>
                </div>
              ) : null}
            </dl>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={send} disabled={pending} className="w-full sm:w-auto">
                {pending ? H.sending : C.send}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(1)}
                disabled={pending}
                className="w-full sm:w-auto"
              >
                {C.edit}
              </Button>
            </div>
          </>
        ) : null}

        {step === 'sent' ? <BotBubble>{H.sentMessage(sentTo)}</BotBubble> : null}
      </div>

      {!inFlow || step === 'sent' ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {HELP_QUICK_QUESTIONS.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setOpenQuestionId(q.id)
                setStep('menu')
                setDraft(EMPTY_DRAFT)
                setError(null)
              }}
              aria-pressed={openQuestionId === q.id}
              className={`rounded-full border px-4 py-2 text-sm text-left transition-colors ${
                openQuestionId === q.id
                  ? 'border-[#ba3d3d] text-[#ba3d3d] bg-[#ba3d3d]/5'
                  : 'border-zinc-300 text-gray-700 hover:border-[#ba3d3d] hover:text-[#ba3d3d]'
              }`}
            >
              {q.question}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_DRAFT)
              startChange()
            }}
            className="rounded-full bg-[#ba3d3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#a53434] transition-colors"
          >
            {H.requestChange}
          </button>
        </div>
      ) : null}

      <p className="mt-5 border-t border-zinc-100 pt-4 text-sm text-gray-600">
        {H.notFound.split(SUPPORT_EMAIL)[0]}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#ba3d3d] hover:underline">
          {SUPPORT_EMAIL}
        </a>
        {H.notFound.split(SUPPORT_EMAIL)[1]}
      </p>
    </section>
  )
}
