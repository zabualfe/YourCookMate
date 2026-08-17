import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getAdminStatus, getBillingPlans } from '../api/client'
import type { User } from '../types/auth'

function accountName(user: User) {
  if (user.display_name?.trim()) return user.display_name.trim()
  return user.email.split('@')[0]
}

function initials(user: User) {
  const name = user.display_name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return user.email.slice(0, 2).toUpperCase()
}

export function SidebarAccount() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: billing } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    enabled: isAuthenticated,
  })
  const { data: adminStatus } = useQuery({
    queryKey: ['admin-status'],
    queryFn: getAdminStatus,
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!user) {
    return (
      <div className="bg-white p-3">
        <Link
          to="/plans"
          className="mb-3 block w-full rounded-full bg-brand-700 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          Upgrade to Pro
        </Link>
        <Link
          to="/login"
          className="block w-full rounded-full border border-stone-200 px-3 py-2 text-center text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
        >
          Sign in
        </Link>
      </div>
    )
  }

  const isPro = billing?.is_pro ?? user.is_pro

  const goProfile = () => {
    setMenuOpen(false)
    navigate('/profile')
  }

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/')
  }

  return (
    <div className="bg-white p-3">
      <Link
        to="/plans"
        className="mb-3 block w-full rounded-full bg-brand-700 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-800"
      >
        {isPro ? 'Plans' : 'Upgrade to Pro'}
      </Link>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goProfile}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
              {initials(user)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-900">{accountName(user)}</p>
            <p className="truncate text-xs text-stone-500">
              {user.username ? `@${user.username}` : isPro ? (billing?.cancel_at_period_end ? 'Pro · canceling' : 'Pro') : 'Free plan'}
            </p>
          </div>
        </button>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Settings"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
          >
            <GearIcon />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full right-0 z-50 mb-2 w-44 origin-bottom-right rounded-xl border border-stone-200 bg-white py-1 shadow-lg shadow-stone-200/50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={goProfile}
                className="block w-full px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
              >
                Profile
              </button>
              {adminStatus?.is_admin && (
                <Link
                  to="/admin"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
                >
                  Admin
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="block w-full px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GearIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
