import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import {
  disconnectInstacart,
  getFeatures,
  getInstacartConnectStatus,
  startInstacartConnect,
} from '@/api/client'
import { colors } from '@/constants/theme'

const RETURN_URL = 'yourcookmate://profile'

function parseInstacartResult(url: string): string | null {
  const parsed = Linking.parse(url)
  const instacart = parsed.queryParams?.instacart
  if (typeof instacart !== 'string') return null
  if (instacart === 'linked') return 'Instacart account linked successfully.'
  if (instacart === 'error') {
    const message = parsed.queryParams?.message
    return typeof message === 'string'
      ? decodeURIComponent(message.replace(/\+/g, ' '))
      : 'Could not link Instacart account.'
  }
  return null
}

export function InstacartConnectCard() {
  const queryClient = useQueryClient()
  const [banner, setBanner] = useState<string | null>(null)

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: getFeatures,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['instacart-connect'],
    queryFn: getInstacartConnectStatus,
    enabled: !!features?.instacart,
  })

  useEffect(() => {
    const handleUrl = (url: string) => {
      const message = parseInstacartResult(url)
      if (message) {
        setBanner(message)
        queryClient.invalidateQueries({ queryKey: ['instacart-connect'] })
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    })

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [queryClient])

  const connectMutation = useMutation({
    mutationFn: () => startInstacartConnect(RETURN_URL),
    onSuccess: async ({ authorize_url }) => {
      const result = await WebBrowser.openAuthSessionAsync(authorize_url, RETURN_URL)
      if (result.type === 'success' && result.url) {
        const message = parseInstacartResult(result.url)
        if (message) {
          setBanner(message)
          queryClient.invalidateQueries({ queryKey: ['instacart-connect'] })
        }
      }
    },
    onError: (err) => {
      setBanner(err instanceof Error ? err.message : 'Could not start Instacart linking')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectInstacart,
    onSuccess: () => {
      setBanner('Disconnected from Your Cook Mate.')
      queryClient.invalidateQueries({ queryKey: ['instacart-connect'] })
    },
  })

  if (!features?.instacart) {
    return null
  }

  if (isLoading) {
    return (
      <View style={styles.cardMuted}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.mutedText}>Checking Instacart connection…</Text>
      </View>
    )
  }

  if (!data?.configured) {
    return (
      <View style={styles.cardMuted}>
        <Text style={styles.title}>Instacart</Text>
        <Text style={styles.body}>
          Shop on Instacart opens Instacart in your browser to add ingredients. In-app account
          linking requires Instacart Connect partner credentials.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.titleGreen}>Instacart account</Text>

      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      {data.linked ? (
        <>
          <Text style={styles.body}>
            Your account is linked to Instacart.
            {data.instacart_plus_member
              ? ` Instacart+ active${data.expired_at ? ` until ${new Date(data.expired_at).toLocaleDateString()}` : ''}.`
              : ' Instacart+ not active on this account.'}
          </Text>
          <Pressable
            onPress={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            style={styles.linkBtn}
          >
            <Text style={styles.linkBtnText}>
              {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Link your Instacart account so we recognize you when you shop recipe ingredients.
          </Text>
          <Pressable
            onPress={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {connectMutation.isPending ? 'Opening Instacart…' : 'Connect Instacart account'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    padding: 20,
  },
  cardMuted: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    backgroundColor: colors.stone50,
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.stone900,
  },
  titleGreen: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803d',
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.stone700,
  },
  mutedText: {
    fontSize: 14,
    color: colors.stone500,
  },
  banner: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.stone700,
  },
  primaryBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#43b02a',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  linkBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.stone600,
    textDecorationLine: 'underline',
  },
})
