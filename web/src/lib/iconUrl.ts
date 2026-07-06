/** Append a cache-busting query param so replaced icons reload immediately. */
export function bustIconUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const base = url.split('?')[0]
  return `${base}?v=${Date.now()}`
}
