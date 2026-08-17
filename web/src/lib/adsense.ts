export const ADSENSE_CLIENT = 'ca-pub-5419342004616646'

export const ADSENSE_SLOTS = {
  banner: import.meta.env.VITE_ADSENSE_SLOT_BANNER as string | undefined,
  infeed: import.meta.env.VITE_ADSENSE_SLOT_INFEED as string | undefined,
  cook: import.meta.env.VITE_ADSENSE_SLOT_COOK as string | undefined,
}

export const IN_FEED_EVERY = 5

export type AdsByGoogle = Array<Record<string, unknown>> & {
  pauseAdRequests?: number
}

declare global {
  interface Window {
    adsbygoogle: AdsByGoogle
  }
}

export function getAdsByGoogle(): AdsByGoogle {
  window.adsbygoogle = window.adsbygoogle || []
  return window.adsbygoogle
}

export function shouldInsertInFeedAd(index: number, total: number) {
  const position = index + 1
  return position % IN_FEED_EVERY === 0 && position < total
}
