import { Link } from 'react-router-dom'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0] ?? name).slice(0, 2).toUpperCase()
}

export function AuthorAvatar({
  name,
  avatarUrl,
  size = 'sm',
}: {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass =
    size === 'lg' ? 'h-20 w-20 text-xl' : size === 'md' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800`}
    >
      {initials(name)}
    </span>
  )
}

export function AuthorLink({
  username,
  name,
  avatarUrl,
  className,
  showHandle = true,
}: {
  username?: string | null
  name: string
  avatarUrl?: string | null
  className?: string
  showHandle?: boolean
}) {
  const inner = (
    <>
      <AuthorAvatar name={name} avatarUrl={avatarUrl} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-stone-800">{name}</span>
        {showHandle && username ? (
          <span className="block truncate text-sm text-stone-500">@{username}</span>
        ) : null}
      </span>
    </>
  )

  const classes = ['inline-flex min-w-0 items-center gap-2.5', className].filter(Boolean).join(' ')

  if (!username) {
    return <span className={classes}>{inner}</span>
  }

  return (
    <Link to={`/u/${encodeURIComponent(username)}`} className={`${classes} hover:opacity-90`}>
      {inner}
    </Link>
  )
}
