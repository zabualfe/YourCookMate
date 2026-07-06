interface BrandLogoProps {
  showWordmark?: boolean
  iconClassName?: string
  className?: string
  showBadge?: boolean
}

export function BrandLogo({
  showWordmark = true,
  iconClassName = 'h-6 w-6',
  className = '',
  showBadge = true,
}: BrandLogoProps) {
  const logo = (
    <img
      src="/logo.png"
      alt="Your Cook Mate"
      className={`${iconClassName} shrink-0 object-contain`}
      width={256}
      height={256}
    />
  )

  if (showBadge) {
    return (
      <span
        className={`inline-flex items-center gap-2.5 rounded-xl bg-brand-600 py-1 pl-1 pr-3 shadow-sm shadow-brand-600/20 ${className}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
          {logo}
        </span>
        {showWordmark && (
          <span className="text-base font-semibold tracking-tight text-white">Your Cook Mate</span>
        )}
      </span>
    )
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {logo}
      {showWordmark && (
        <span className="text-base font-semibold tracking-tight text-stone-900">Your Cook Mate</span>
      )}
    </span>
  )
}
