import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { deleteRecipeIcon, uploadRecipeIcon } from '../api/client'
import { getRecipe, saveRecipe } from '../lib/storage'

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
  const [error, setError] = useState('')

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      validateFile(file)
      if (isLocal) {
        const dataUrl = await readFileAsDataUrl(file)
        const stored = getRecipe(recipeId)
        if (!stored) throw new Error('Recipe not found')
        saveRecipe({ ...stored, iconUrl: dataUrl })
        return dataUrl
      }
      const updated = await uploadRecipeIcon(recipeId, file)
      return updated.icon_url ?? null
    },
    onSuccess: (url) => {
      setError('')
      onIconChange?.(url)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Upload failed'),
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
      onIconChange?.(url)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not remove icon'),
  })

  const busy = uploadMutation.isPending || removeMutation.isPending
  const boxClass = sizeClasses[size]

  const handlePick = () => {
    if (!editable || busy) return
    inputRef.current?.click()
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
        title={editable ? (iconUrl ? 'Change icon' : 'Upload icon') : undefined}
        className={[
          boxClass,
          'group relative overflow-hidden border bg-stone-100 transition',
          editable && !busy ? 'cursor-pointer hover:border-brand-300 hover:ring-2 hover:ring-brand-500/20' : '',
          iconUrl ? 'border-stone-200' : 'border-dashed border-stone-300',
          busy ? 'opacity-60' : '',
        ].join(' ')}
      >
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center" aria-hidden>
            🍽️
          </span>
        )}
        {editable && !busy && (
          <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            {iconUrl ? 'Change' : 'Add'}
          </span>
        )}
      </button>

      {editable && iconUrl && !busy && (
        <button
          type="button"
          onClick={() => removeMutation.mutate()}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-stone-200 bg-white text-xs text-stone-500 shadow-sm hover:bg-red-50 hover:text-red-600"
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

      {error && (
        <p className="absolute left-0 top-full z-10 mt-1 w-48 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
