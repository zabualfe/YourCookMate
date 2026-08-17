import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { followUser, unfollowUser } from '../api/client'
import { useAuth } from '../context/AuthContext'

interface FollowButtonProps {
  username: string
  isFollowing: boolean
  isSelf?: boolean
}

export function FollowButton({ username, isFollowing, isSelf }: FollowButtonProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => (isFollowing ? unfollowUser(username) : followUser(username)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-profile'] })
      queryClient.invalidateQueries({ queryKey: ['shared-recipe'] })
      queryClient.invalidateQueries({ queryKey: ['community-recipes'] })
      queryClient.invalidateQueries({ queryKey: ['followers'] })
      queryClient.invalidateQueries({ queryKey: ['following-users'] })
    },
  })

  if (isSelf) return null

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`
    return (
      <Link
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Follow
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={
        isFollowing
          ? 'inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60'
          : 'inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60'
      }
    >
      {mutation.isPending ? 'Saving…' : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
