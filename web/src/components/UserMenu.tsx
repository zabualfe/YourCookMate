import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function firstName(user: { display_name?: string | null; email: string }) {
  if (user.display_name?.trim()) {
    return user.display_name.trim().split(/\s+/)[0]
  }
  return user.email.split('@')[0]
}

function initials(user: { display_name?: string | null; email: string }) {
  const name = user.display_name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return user.email.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const name = firstName(user)

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/')
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-stone-100"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
            {initials(user)}
          </span>
        )}
        <span className="max-w-[100px] truncate text-sm font-medium text-stone-800">{name}</span>
        <svg
          className={`h-4 w-4 text-stone-400 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-xl border border-stone-200 bg-white py-1 shadow-lg shadow-stone-200/50"
        >
          <div className="border-b border-stone-100 px-4 py-2.5">
            <p className="truncate text-sm font-medium text-stone-900">{name}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50"
          >
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
