import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { deleteRecipeIcon, uploadRecipeIcon } from '../api/client'
import { bustIconUrl } from '../lib/iconUrl'
import { foodIconPresetToFile } from '../lib/foodIconToImage'
import type { FoodIconPreset } from '../lib/foodIcons'
import { getRecipe, saveRecipe } from '../lib/storage'
import { FoodIconPicker } from './FoodIconPicker'
import { UtensilsCrossed } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const MAX_BYTES = 2 * 1024 * 1024

const sizeClasses = {
  sm: 'h-12 w-12 rounded-xl text-lg',
  lg: 'h-20 w-20 rounded-2xl text-2xl sm:h-24 sm:w-24',
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function validateFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be 2 MB or smaller.')
  }
}

interface RecipeIconProps {
  recipeId: string
  iconUrl?: string | null
  editable?: boolean
  size?: 'sm' | 'lg'
  isLocal?: boolean
  onIconChange?: (iconUrl: string | null) => void
}

export function RecipeIcon({
  recipeId,
  iconUrl,
  editable = false,
  size = 'lg',
  isLocal = false,
  onIconChange,
}: RecipeIconProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [displayUrl, setDisplayUrl] = useState<string | null>(iconUrl ?? null)

  useEffect(() => {
    setDisplayUrl(iconUrl ?? null)
  }, [iconUrl, recipeId])

  const commitIcon = (url: string | null) => {
    const next = bustIconUrl(url)
    setDisplayUrl(next)
    onIconChange?.(next)
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      validateFile(file)
      const preview = await readFileAsDataUrl(file)
      setDisplayUrl(bustIconUrl(preview))
      if (isLocal) {
        const stored = getRecipe(recipeId)
        if (!stored) throw new Error('Recipe not found')
        saveRecipe({ ...stored, iconUrl: preview })
        return preview
      }
      const updated = await uploadRecipeIcon(recipeId, file)
      return updated.icon_url ?? preview
    },
    onSuccess: (url) => {
      setError('')
      setPickerOpen(false)
      commitIcon(url)
    },
    onError: (err) => {
      setDisplayUrl(iconUrl ?? null)
      setError(err instanceof Error ? err.message : 'Upload failed')
    },
  })

  const presetMutation = useMutation({
    mutationFn: async (preset: FoodIconPreset) => {
      const file = await foodIconPresetToFile(preset)
      const preview = await readFileAsDataUrl(file)
      setDisplayUrl(bustIconUrl(preview))
      if (isLocal) {
        const stored = getRecipe(recipeId)
        if (!stored) throw new Error('Recipe not found')
        saveRecipe({ ...stored, iconUrl: preview })
        return preview
      }
      const updated = await uploadRecipeIcon(recipeId, file)
      return updated.icon_url ?? preview
    },
    onSuccess: (url) => {
      setError('')
      setPickerOpen(false)
      commitIcon(url)
    },
    onError: (err) => {
      setDisplayUrl(iconUrl ?? null)
      setError(err instanceof Error ? err.message : 'Could not set icon')
    },
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (isLocal) {
        const stored = getRecipe(recipeId)
        if (!stored) throw new Error('Recipe not found')
        saveRecipe({ ...stored, iconUrl: undefined })
        return null
      }
      const updated = await deleteRecipeIcon(recipeId)
      return updated.icon_url ?? null
    },
    onSuccess: (url) => {
      setError('')
      setDisplayUrl(url)
      onIconChange?.(url)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not remove icon'),
  })

  const busy = uploadMutation.isPending || presetMutation.isPending || removeMutation.isPending
  const boxClass = sizeClasses[size]

  const handlePick = () => {
    if (!editable || busy) return
    setPickerOpen(true)
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handlePick}
        disabled={!editable || busy}
        title={editable ? (displayUrl ? 'Change icon' : 'Choose icon') : undefined}
        className={[
          boxClass,
          'group relative overflow-hidden border bg-stone-100 transition',
          editable && !busy ? 'cursor-pointer hover:border-brand-300 hover:ring-2 hover:ring-brand-500/20' : '',
          displayUrl ? 'border-stone-200' : 'border-dashed border-stone-300',
          busy ? 'opacity-60' : '',
        ].join(' ')}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-stone-400" aria-hidden>
            <UtensilsCrossed className={size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'} strokeWidth={1.75} />
          </span>
        )}
        {editable && !busy && (
          <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            {displayUrl ? 'Change' : 'Choose'}
          </span>
        )}
      </button>

      {editable && displayUrl && !busy && (
        <button
          type="button"
          onClick={() => removeMutation.mutate()}
          className="absolute -right-1 -top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-xs text-stone-500 shadow-sm hover:bg-red-50 hover:text-red-600"
          title="Remove icon"
          aria-label="Remove icon"
        >
          ×
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {editable && (
        <FoodIconPicker
          open={pickerOpen}
          busy={busy}
          onClose={() => setPickerOpen(false)}
          onSelect={(preset) => presetMutation.mutate(preset)}
          onUploadPhoto={() => {
            setPickerOpen(false)
            inputRef.current?.click()
          }}
        />
      )}

      {error && (
        <p className="absolute left-0 top-full z-10 mt-1 w-48 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
