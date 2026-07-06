import { useEffect, useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { FOOD_ICON_PRESETS, type FoodIconPreset } from '../lib/foodIcons'

interface FoodIconPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (preset: FoodIconPreset) => void
  onUploadPhoto?: () => void
  busy?: boolean
}

export function FoodIconPicker({
  open,
  onClose,
  onSelect,
  onUploadPhoto,
  busy = false,
}: FoodIconPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={() => {
        if (!busy) onClose()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="food-icon-picker-title"
        className="flex max-h-[min(85dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 id="food-icon-picker-title" className="text-lg font-bold text-stone-900">
              Choose a food icon
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">Pick one that matches your recipe.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
            {FOOD_ICON_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() => onSelect(preset)}
                className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-2 transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                title={preset.label}
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-stone-200/80 transition group-hover:border-brand-300 group-hover:shadow-sm"
                  style={{ backgroundColor: preset.background, color: preset.foreground }}
                >
                  <preset.Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-stone-600">
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {onUploadPhoto && (
          <div className="shrink-0 border-t border-stone-200 px-5 py-4">
            <button
              type="button"
              disabled={busy}
              onClick={onUploadPhoto}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Upload your own photo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
