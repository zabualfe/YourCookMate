interface StepNavigatorProps {
  onPrev: () => void
  onNext: () => void
  isFirst: boolean
  isLast: boolean
}

export function StepNavigator({ onPrev, onNext, isFirst, isLast }: StepNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-stone-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        className="min-h-12 min-w-[100px] rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 transition enabled:hover:bg-stone-50 disabled:opacity-30"
      >
        Previous
      </button>
      <button
        type="button"
        onClick={onNext}
        className="min-h-12 flex-1 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {isLast ? 'Done' : 'Next step'}
      </button>
    </div>
  )
}
