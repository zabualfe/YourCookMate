import { Stack } from 'expo-router'
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito'
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
} from '@expo-google-fonts/nunito-sans'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider } from '@/context/AuthContext'
import { FeaturesProvider } from '@/context/FeaturesContext'
import { colors } from '@/constants/theme'

const queryClient = new QueryClient()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
  })

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <FeaturesProvider>
            <AuthProvider>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.white },
                  headerTintColor: colors.brand600,
                  headerTitleStyle: { fontFamily: 'Nunito_600SemiBold' },
                  contentStyle: { backgroundColor: colors.surface },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: true, title: 'Sign in' }} />
                <Stack.Screen name="register" options={{ presentation: 'modal', headerShown: true, title: 'Register' }} />
                <Stack.Screen name="review" options={{ headerShown: true, title: 'Review recipe' }} />
                <Stack.Screen name="cook/[id]" options={{ gestureEnabled: false, headerShown: false }} />
                <Stack.Screen name="recipes/[id]" options={{ headerShown: true }} />
                <Stack.Screen name="recipes/edit/[id]" options={{ headerShown: true, title: 'Edit recipe' }} />
              </Stack>
            </AuthProvider>
          </FeaturesProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
