import { Link } from 'react-router-dom'
import type { RecipeCollectionTag } from '../types/collection'

interface RecipeCollectionChipsProps {
  collections: RecipeCollectionTag[]
  emptyLabel?: string
}

export function RecipeCollectionChips({
  collections,
  emptyLabel = 'Not in any collection',
}: RecipeCollectionChipsProps) {
  if (collections.length === 0) {
    return <p className="text-xs text-stone-400">{emptyLabel}</p>
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {collections.map((col) => (
        <Link
          key={col.id}
          to={`/collections/${col.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700 transition hover:bg-brand-50 hover:text-brand-800"
        >
          <FolderIcon />
          {col.name}
        </Link>
      ))}
    </div>
  )
}

function FolderIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}
