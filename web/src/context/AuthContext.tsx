import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '../types/auth'
import { fetchMe, getToken, setToken } from '../api/client'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  setSession: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const setSession = useCallback((token: string, nextUser: User) => {
    setToken(token)
    setUser(nextUser)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      return
    }
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      setSession,
      logout,
      refreshUser,
    }),
    [user, loading, setSession, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
