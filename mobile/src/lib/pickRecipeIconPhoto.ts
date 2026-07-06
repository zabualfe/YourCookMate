export type RecipeIconPhotoSource = 'camera' | 'library'

export interface PickedRecipeIconPhoto {
  uri: string
  fileName: string
  mimeType: string
  fileSize?: number
}

const PICKER_OPTIONS = {
  mediaTypes: ['images'] as ('images' | 'videos' | 'livePhotos')[],
  allowsEditing: true,
  aspect: [1, 1] as [number, number],
  quality: 0.92,
}

function assetToPhoto(asset: {
  uri: string
  fileName?: string | null
  mimeType?: string
  fileSize?: number
}): PickedRecipeIconPhoto {
  const mimeType = asset.mimeType ?? 'image/jpeg'
  const ext =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/gif' ? 'gif' : 'jpg'
  return {
    uri: asset.uri,
    mimeType,
    fileName: asset.fileName ?? `recipe-icon.${ext}`,
    fileSize: asset.fileSize,
  }
}

function nativeModuleMessage(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err)
  if (
    message.includes('ExponentImagePicker') ||
    message.includes('native module') ||
    message.includes('unknown module')
  ) {
    return 'Rebuild the app to enable photos (npx expo run:ios).'
  }
  return null
}

export async function pickRecipeIconPhoto(source: RecipeIconPhotoSource): Promise<PickedRecipeIconPhoto | null> {
  try {
    const ImagePicker = await import('expo-image-picker')

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        throw new Error('Camera access is required to take a photo.')
      }
      const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      if (result.canceled || !result.assets[0]) return null
      return assetToPhoto(result.assets[0])
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      throw new Error('Photo library access is required to choose an image.')
    }
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS)
    if (result.canceled || !result.assets[0]) return null
    return assetToPhoto(result.assets[0])
  } catch (err) {
    const native = nativeModuleMessage(err)
    if (native) throw new Error(native)
    throw err
  }
}

export function recipeIconPhotoErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Could not open photo picker'
}
