import type { User } from '../types/auth'

const DEV_VERIFY_KEY = 'yourcookmate_dev_verify_url'

export function storeDevVerifyUrl(url?: string | null) {
  if (url) sessionStorage.setItem(DEV_VERIFY_KEY, url)
}

export function peekDevVerifyUrl(): string | null {
  return sessionStorage.getItem(DEV_VERIFY_KEY)
}

export function postAuthPath(user: User, redirect = '/recipes'): string {
  if (!user.email_verified) {
    return `/verify-email?redirect=${encodeURIComponent(redirect)}`
  }
  return redirect
}
