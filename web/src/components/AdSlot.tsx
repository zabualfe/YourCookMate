import { useEffect, useRef } from 'react'
import { useShowAds } from '../hooks/useShowAds'
import { ADSENSE_CLIENT, ADSENSE_SLOTS, getAdsByGoogle } from '../lib/adsense'

type AdVariant = 'banner' | 'infeed' | 'cook'

interface AdSlotProps {
  variant?: AdVariant
  className?: string
}

const VARIANT_CLASS: Record<AdVariant, string> = {
  banner: 'min-h-[90px] w-full',
  infeed: 'min-h-[100px] w-full',
  cook: 'mx-auto min-h-[70px] w-full max-w-md',
}

export function AdSlot({ variant = 'banner', className = '' }: AdSlotProps) {
  const showAds = useShowAds()
  const insRef = useRef<HTMLModElement>(null)
  const pushed = useRef(false)
  const slot = ADSENSE_SLOTS[variant]
  const format = variant === 'infeed' && slot ? 'fluid' : 'auto'

  useEffect(() => {
    if (!showAds || pushed.current) return
    const el = insRef.current
    if (!el || el.getAttribute('data-adsbygoogle-status')) return
    pushed.current = true
    try {
      getAdsByGoogle().push({})
    } catch {
      pushed.current = false
    }
  }, [showAds])

  if (!showAds) return null

  return (
    <div className={['overflow-hidden rounded-xl border border-stone-200/80 bg-stone-50', className].join(' ')}>
      <p className="px-3 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-stone-400">
        Sponsored
      </p>
      <ins
        ref={insRef}
        className={['adsbygoogle block', VARIANT_CLASS[variant]].join(' ')}
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot || undefined}
        data-ad-format={format}
        data-ad-layout={format === 'fluid' ? 'in-article' : undefined}
        data-full-width-responsive="true"
      />
    </div>
  )
}
