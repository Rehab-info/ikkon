import { Link } from 'react-router-dom'
import { BRAND, BRAND_MARK } from '../../config/brand'

/** 仮ロゴ。ロゴ確定時はこのコンポーネントを差し替える */
export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label={`${BRAND.name} トップへ`}>
      <span className="inline-flex size-7 items-center justify-center rounded-sm bg-ink text-[11px] font-semibold tracking-wider text-white" aria-hidden>
        {BRAND_MARK}
      </span>
      <span className="text-sm font-semibold tracking-[0.18em] text-ink">{BRAND.name}</span>
    </Link>
  )
}
