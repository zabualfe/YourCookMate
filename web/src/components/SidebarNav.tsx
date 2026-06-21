import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { listCollections } from '../api/client'

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition',
    isActive
      ? 'bg-brand-50 text-brand-800'
      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  ].join(' ')
}

export function SidebarNav() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const onCollectionsRoute = location.pathname.startsWith('/collections')
  const [collectionsOpen, setCollectionsOpen] = useState(onCollectionsRoute)

  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: () => listCollections(),
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (onCollectionsRoute) setCollectionsOpen(true)
  }, [onCollectionsRoute])

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-stone-200 bg-white md:flex md:flex-col">
        <nav className="flex flex-1 flex-col gap-1 p-4">
          <NavLink to="/recipes" className={navClass}>
            <BookIcon />
            My Recipes
          </NavLink>

          <div>
            <button
              type="button"
              onClick={() => setCollectionsOpen((open) => !open)}
              className={[
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                onCollectionsRoute
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
              ].join(' ')}
            >
              <span className="flex items-center gap-2.5">
                <FolderIcon />
                Collections
              </span>
              <ChevronIcon open={collectionsOpen} />
            </button>

            {collectionsOpen && (
              <div className="ml-3 mt-1 space-y-0.5 border-l border-stone-200 pl-3">
                {isAuthenticated ? (
                  <>
                    {collections?.items.map((col) => (
                      <NavLink
                        key={col.id}
                        to={`/collections/${col.id}`}
                        className={({ isActive }) =>
                          [
                            'block truncate rounded-md px-2 py-1.5 text-sm transition',
                            isActive
                              ? 'bg-brand-50 font-medium text-brand-800'
                              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                          ].join(' ')
                        }
                      >
                        {col.name}
                      </NavLink>
                    ))}
                    {collections && collections.items.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-stone-400">No collections yet</p>
                    )}
                    <Link
                      to="/collections"
                      className="block rounded-md px-2 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
                    >
                      Manage collections
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/login?redirect=/collections"
                    className="block px-2 py-1.5 text-sm text-stone-500 hover:text-brand-600"
                  >
                    Sign in to view
                  </Link>
                )}
              </div>
            )}
          </div>

          <NavLink to="/community" className={navClass}>
            <UsersIcon />
            Community Recipes
          </NavLink>
        </nav>
      </aside>

      <nav className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-3 py-2 md:hidden">
        <MobileNavLink to="/recipes">My Recipes</MobileNavLink>
        <MobileNavLink to="/collections">Collections</MobileNavLink>
        <MobileNavLink to="/community">Community</MobileNavLink>
      </nav>
    </>
  )
}

function MobileNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'shrink-0 rounded-lg px-3 py-2 text-sm font-medium',
          isActive ? 'bg-brand-50 text-brand-800' : 'text-stone-600',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}

function BookIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
