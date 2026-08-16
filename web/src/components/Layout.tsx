import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeatures } from '../context/FeaturesContext'
import { BrandLogo } from './BrandLogo'
import { UserMenu } from './UserMenu'
import { SidebarNav } from './SidebarNav'

interface LayoutProps {
  children: React.ReactNode
  hideNav?: boolean
  showSidebar?: boolean
}

function shouldShowSidebar(pathname: string, hideNav?: boolean, override?: boolean) {
  if (override !== undefined) return override && !hideNav
  if (hideNav) return false
  if (pathname === '/') return false
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) return false
  if (pathname.startsWith('/verify-email')) return false
  if (pathname.startsWith('/cook/')) return false

  const sidebarRoots = [
    '/recipes',
    '/collections',
    '/community',
    '/profile',
    '/plans',
    '/new',
    '/r',
    '/billing',
    '/admin',
  ]
  return sidebarRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

export function Layout({ children, hideNav, showSidebar }: LayoutProps) {
  const { isAuthenticated, loading, user } = useAuth()
  const features = useFeatures()
  const { pathname } = useLocation()
  const sidebarVisible = shouldShowSidebar(pathname, hideNav, showSidebar)

  return (
    <div
      className={
        sidebarVisible
          ? 'flex h-dvh flex-col overflow-hidden bg-surface'
          : 'flex min-h-dvh flex-col bg-surface'
      }
    >
      {!hideNav && (
        <>
          {user && !user.email_verified && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-center text-sm text-amber-900 sm:px-8">
              Verify your email to save recipes.{' '}
              <Link to="/verify-email" className="font-semibold underline hover:text-amber-950">
                Check inbox or resend link
              </Link>
            </div>
          )}
          <header className="sticky top-0 z-40 shrink-0 border-b border-stone-200/70 bg-white/95 backdrop-blur-md">
            <div className="flex h-14 w-full items-center justify-between gap-4 px-5 sm:px-8">
              <Link
                to={isAuthenticated ? '/recipes' : '/'}
                className="flex shrink-0 items-center font-semibold text-stone-900 transition hover:opacity-80"
              >
                <BrandLogo showBadge={false} />
              </Link>

              <nav className="flex items-center gap-1 sm:gap-2">
                <Link
                  to="/new"
                  className="rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 sm:px-4"
                >
                  Add recipe
                </Link>

                {!loading &&
                  features.auth &&
                  (isAuthenticated ? (
                    <div className="ml-1 border-l border-stone-200 pl-2 sm:ml-2 sm:pl-3">
                      <UserMenu />
                    </div>
                  ) : (
                    <Link
                      to="/login"
                      className="ml-1 rounded-lg border border-stone-200 px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:ml-2"
                    >
                      Sign in
                    </Link>
                  ))}
              </nav>
            </div>
          </header>
        </>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {sidebarVisible && <SidebarNav />}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
