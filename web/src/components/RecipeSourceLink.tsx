import { LinkIcon } from './icons'

interface RecipeSourceLinkProps {
  url: string
  className?: string
}

export function RecipeSourceLink({ url, className = '' }: RecipeSourceLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={[
        'inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700 hover:underline',
        className,
      ].join(' ')}
    >
      <LinkIcon />
      Source
    </a>
  )
}
