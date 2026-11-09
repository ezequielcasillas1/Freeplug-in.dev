import { PersonalDownloadForm } from './PersonalDownloadForm'

type Copy = {
  comingSoon: string
  downloadCta: string
  emailOptional: string
  emailPlaceholder: string
  licenseNote: string
  errorGeneric: string
}

export function PersonalDownloadBlock({ copy, enabled }: { copy: Copy; enabled: boolean }) {
  if (!enabled) {
    return (
      <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700" role="status">
        {copy.comingSoon}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <PersonalDownloadForm
        label={copy.downloadCta}
        emailOptional={copy.emailOptional}
        emailPlaceholder={copy.emailPlaceholder}
        errorGeneric={copy.errorGeneric}
      />
      <p className="text-sm text-gray-600">{copy.licenseNote}</p>
    </div>
  )
}
