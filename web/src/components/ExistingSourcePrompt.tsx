type ExistingSourceKind = 'library' | 'generated'

export function ExistingSourcePrompt({
  kind,
  title,
  thumbnailUrl,
  busy,
  onUseExisting,
  onGenerateNew,
  onDismiss,
}: {
  kind: ExistingSourceKind
  title?: string | null
  thumbnailUrl?: string | null
  busy?: boolean
  onUseExisting: () => void
  onGenerateNew: () => void
  onDismiss: () => void
}) {
  const named = title?.trim()
  const heading =
    kind === 'library' ? 'You already have this recipe' : 'We’ve already made this recipe'
  const body =
    kind === 'library'
      ? named
        ? `“${named}” is already in your kitchen. Open the one you saved, or make a new version from this video.`
        : 'This video is already in your kitchen. Open the recipe you saved, or make a new version from this video.'
      : named
        ? `We already turned this video into “${named}”. Use that version, or generate a new one — that takes a little longer.`
        : 'We’ve already turned this video into a step-by-step recipe. Use the saved version, or generate a new one — that takes a little longer.'
  const useLabel = kind === 'library' ? 'Open saved recipe' : 'Use saved recipe'
  const generateLabel = kind === 'library' ? 'Make a new version' : 'Generate a new one'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="existing-source-title"
        aria-describedby="existing-source-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="px-5 py-5">
          <div className="flex items-start gap-4">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <h2 id="existing-source-title" className="text-lg font-semibold text-stone-900">
                {heading}
              </h2>
              <p id="existing-source-description" className="mt-2 text-sm leading-relaxed text-stone-600">
                {body}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-stone-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onGenerateNew}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            {generateLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onUseExisting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {useLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
