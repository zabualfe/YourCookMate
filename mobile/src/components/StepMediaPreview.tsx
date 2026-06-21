import { useEffect } from 'react'
import { AppState, Image, StyleSheet, View, type AppStateStatus } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { resolveMediaUrl } from '@/lib/mediaUrl'
import { colors } from '@/constants/theme'

interface StepMediaPreviewProps {
  clipUrl?: string | null
  imageUrl?: string | null
  /** Full-width media for cook mode; compact thumbnail for lists. */
  variant?: 'cook' | 'inline'
  /** When true, plays a muted looping clip (cook mode only). */
  playClip?: boolean
}

function safePlayerCall(action: () => void) {
  try {
    action()
  } catch {
    // Native player may already be released during unmount.
  }
}

function StepClipPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true
    instance.muted = true
    instance.play()
  })

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        safePlayerCall(() => player.play())
      } else {
        safePlayerCall(() => player.pause())
      }
    }
    const sub = AppState.addEventListener('change', onAppState)
    return () => sub.remove()
  }, [player])

  return (
    <VideoView
      player={player}
      style={styles.mediaFill}
      contentFit="contain"
      nativeControls={false}
    />
  )
}

export function StepMediaPreview({
  clipUrl,
  imageUrl,
  variant = 'inline',
  playClip = false,
}: StepMediaPreviewProps) {
  const clipUri = resolveMediaUrl(clipUrl)
  const imageUri = resolveMediaUrl(imageUrl)
  const shouldPlayClip = playClip && Boolean(clipUri)

  if (!shouldPlayClip && !imageUri) {
    return null
  }

  const wrapStyle = variant === 'cook' ? styles.cookWrap : styles.inlineWrap

  return (
    <View style={wrapStyle}>
      {shouldPlayClip ? (
        <StepClipPlayer key={clipUri} uri={clipUri!} />
      ) : (
        <Image source={{ uri: imageUri! }} style={styles.mediaFill} resizeMode="contain" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cookWrap: {
    width: '100%',
    maxHeight: '40%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.stone100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 160,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.stone100,
    marginBottom: 8,
  },
  mediaFill: {
    width: '100%',
    height: '100%',
  },
})
