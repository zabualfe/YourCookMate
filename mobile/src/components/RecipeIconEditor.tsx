import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteRecipeIcon, uploadRecipeIcon } from '@/api/client'
import { colors, fonts, radii } from '@/constants/theme'
import { FoodIconPicker } from '@/components/FoodIconPicker'
import { bustIconUrl, resolveMediaUrl } from '@/lib/mediaUrl'
import type { RecipeDetailResponse, RecipeListResponse } from '@/types/recipe'
import {
  pickRecipeIconPhoto,
  recipeIconPhotoErrorMessage,
  type PickedRecipeIconPhoto,
  type RecipeIconPhotoSource,
} from '@/lib/pickRecipeIconPhoto'
import type { FoodIconPreset } from '@/lib/foodIcons'

const MAX_BYTES = 2 * 1024 * 1024

const sizeMap = {
  sm: { box: 48, icon: 22, radius: radii.md },
  lg: { box: 80, icon: 32, radius: radii.xxl },
} as const

interface RecipeIconEditorProps {
  recipeId: string
  iconUrl?: string | null
  size?: 'sm' | 'lg'
  onIconChange?: (iconUrl: string | null) => void
  /** When set, errors are reported here instead of rendering under the icon. */
  onErrorChange?: (message: string) => void
}

async function capturePresetIcon(preset: FoodIconPreset, ref: View): Promise<string> {
  const { foodIconPresetToUri } = await import('@/lib/foodIconCapture')
  return foodIconPresetToUri(preset, ref)
}

/** Editable recipe icon — lazy-loads native modules (image picker, view-shot). */
export function RecipeIconEditor({
  recipeId,
  iconUrl,
  size = 'lg',
  onIconChange,
  onErrorChange,
}: RecipeIconEditorProps) {
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [displayUrl, setDisplayUrl] = useState<string | null>(iconUrl ?? null)
  const [capturePreset, setCapturePreset] = useState<FoodIconPreset | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [CaptureView, setCaptureView] = useState<typeof import('@/lib/foodIconCapture').FoodIconPresetView | null>(null)
  const captureRef = useRef<View>(null)

  useEffect(() => {
    setDisplayUrl(iconUrl ?? null)
    setImageFailed(false)
  }, [iconUrl, recipeId])

  useEffect(() => {
    onErrorChange?.(error)
  }, [error, onErrorChange])

  useEffect(() => {
    if (!capturePreset) return
    void import('@/lib/foodIconCapture').then((mod) => setCaptureView(() => mod.FoodIconPresetView))
  }, [capturePreset])

  const syncIconCache = (url: string | null) => {
    const busted = bustIconUrl(url)
    setDisplayUrl(busted)
    setImageFailed(false)
    onIconChange?.(busted)

    queryClient.setQueryData<RecipeDetailResponse>(['recipe', recipeId], (old) => {
      if (!old) return old
      return { ...old, icon_url: busted }
    })

    queryClient.setQueriesData<RecipeListResponse>({ queryKey: ['recipes'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((item) =>
          item.id === recipeId ? { ...item, icon_url: busted } : item,
        ),
      }
    })
  }

  const uploadUriMutation = useMutation({
    mutationFn: async (photo: PickedRecipeIconPhoto) => {
      const updated = await uploadRecipeIcon(recipeId, {
        uri: photo.uri,
        name: photo.fileName,
        type: photo.mimeType,
      })
      return updated
    },
    onSuccess: (updated) => {
      setError('')
      setPickerOpen(false)
      syncIconCache(updated.icon_url ?? null)
    },
    onError: (err) => {
      setDisplayUrl(bustIconUrl(iconUrl ?? null))
      setError(err instanceof Error ? err.message : 'Upload failed')
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => deleteRecipeIcon(recipeId),
    onSuccess: (updated) => {
      setError('')
      syncIconCache(updated.icon_url ?? null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not remove icon'),
  })

  useEffect(() => {
    if (!capturePreset || !captureRef.current || !CaptureView) return
    let cancelled = false
    const run = async () => {
      try {
        const uri = await capturePresetIcon(capturePreset, captureRef.current!)
        if (cancelled) return
        uploadUriMutation.mutate({ uri, fileName: 'recipe-icon.png', mimeType: 'image/png' })
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Could not set icon'
          if (message.includes('native module') || message.includes('ViewShot')) {
            setError('Rebuild the app to enable icon uploads (expo run:ios).')
          } else {
            setError(message)
          }
        }
      } finally {
        if (!cancelled) {
          setCapturePreset(null)
          setCaptureView(null)
        }
      }
    }
    requestAnimationFrame(() => {
      void run()
    })
    return () => {
      cancelled = true
    }
  }, [capturePreset, CaptureView])

  const busy = uploadUriMutation.isPending || removeMutation.isPending || capturePreset !== null
  const dims = sizeMap[size]
  const resolvedDisplay = resolveMediaUrl(displayUrl)
  const showImage = Boolean(resolvedDisplay) && !imageFailed

  const handlePickPhoto = async (source: RecipeIconPhotoSource) => {
    setPickerOpen(false)
    try {
      const photo = await pickRecipeIconPhoto(source)
      if (!photo) return
      if (photo.fileSize && photo.fileSize > MAX_BYTES) {
        setError('Image must be 2 MB or smaller.')
        return
      }
      setDisplayUrl(photo.uri)
      setImageFailed(false)
      uploadUriMutation.mutate(photo)
    } catch (err) {
      setError(recipeIconPhotoErrorMessage(err))
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.iconSlot}>
        <Pressable
          disabled={busy}
          onPress={() => !busy && setPickerOpen(true)}
          accessibilityLabel={displayUrl ? 'Change icon' : 'Choose icon'}
          style={[
            styles.box,
            {
              width: dims.box,
              height: dims.box,
              borderRadius: dims.radius,
            },
            displayUrl ? styles.boxFilled : styles.boxEmpty,
            busy && styles.busy,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.brand} />
          ) : showImage ? (
            <Image
              key={resolvedDisplay!}
              source={{ uri: resolvedDisplay! }}
              style={[styles.image, { borderRadius: dims.radius }]}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <MaterialCommunityIcons name="silverware-fork-knife" size={dims.icon} color={colors.stone400} />
          )}
        </Pressable>

        {showImage && !busy && (
          <Pressable
            onPress={() => removeMutation.mutate()}
            style={styles.removeBtn}
            accessibilityLabel="Remove icon"
            hitSlop={4}
          >
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        )}
      </View>

      <FoodIconPicker
        visible={pickerOpen}
        busy={busy}
        onClose={() => setPickerOpen(false)}
        onSelect={(preset) => {
          setPickerOpen(false)
          setCapturePreset(preset)
        }}
        onTakePhoto={() => void handlePickPhoto('camera')}
        onChooseFromLibrary={() => void handlePickPhoto('library')}
      />

      {capturePreset && CaptureView && (
        <View style={styles.offscreen} pointerEvents="none">
          <CaptureView ref={captureRef} preset={capturePreset} />
        </View>
      )}

      {error && !onErrorChange ? (
        <Text style={[styles.error, { maxWidth: dims.box }]}>{error}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    gap: 6,
  },
  iconSlot: {
    position: 'relative',
  },
  box: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: colors.stone100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.stone200 },
  boxEmpty: { borderColor: colors.stone300, borderStyle: 'dashed' },
  busy: { opacity: 0.6 },
  image: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 14,
    lineHeight: 16,
    color: colors.stone500,
  },
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    color: colors.red700,
  },
})
