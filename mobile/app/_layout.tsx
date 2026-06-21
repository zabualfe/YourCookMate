import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/context/AuthContext'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ title: 'Home' }} />
              <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: true, title: 'Sign in' }} />
              <Stack.Screen name="register" options={{ presentation: 'modal', headerShown: true, title: 'Register' }} />
              <Stack.Screen name="review" options={{ headerShown: true, title: 'Review recipe' }} />
              <Stack.Screen name="cook/[id]" options={{ gestureEnabled: false }} />
              <Stack.Screen
                name="recipes/[id]"
                options={{
                  headerShown: true,
                }}
              />
              <Stack.Screen
                name="recipes/edit/[id]"
                options={{
                  headerShown: true,
                }}
              />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
