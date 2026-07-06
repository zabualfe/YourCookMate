import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { colors, radii } from '@/constants/theme'
import { resolveMediaUrl } from '@/lib/mediaUrl'

const sizeMap = {
  sm: { box: 48, icon: 22, radius: radii.md },
  lg: { box: 80, icon: 32, radius: radii.xxl },
} as const

interface RecipeIconProps {
  iconUrl?: string | null
  size?: 'sm' | 'lg'
}

/** Read-only recipe thumbnail — no native module dependencies. */
export function RecipeIcon({ iconUrl, size = 'lg' }: RecipeIconProps) {
  const [failed, setFailed] = useState(false)
  const dims = sizeMap[size]
  const resolved = resolveMediaUrl(iconUrl)
  const showImage = Boolean(resolved) && !failed

  useEffect(() => {
    setFailed(false)
  }, [iconUrl])

  return (
    <View
      style={[
        styles.box,
        {
          width: dims.box,
          height: dims.box,
          borderRadius: dims.radius,
        },
        showImage ? styles.boxFilled : styles.boxEmpty,
      ]}
    >
      {showImage ? (
        <Image
          key={resolved!}
          source={{ uri: resolved! }}
          style={[styles.image, { borderRadius: dims.radius }]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <MaterialCommunityIcons name="silverware-fork-knife" size={dims.icon} color={colors.stone400} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: colors.stone100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.stone200 },
  boxEmpty: { borderColor: colors.stone300, borderStyle: 'dashed' },
  image: { width: '100%', height: '100%' },
})
