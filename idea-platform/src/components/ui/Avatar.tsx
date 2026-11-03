import type { CreatorProfile } from '../../types'

const tones: Record<CreatorProfile['avatarTone'], string> = {
  navy: 'bg-ink text-white',
  slate: 'bg-[#4a5563] text-white',
  brass: 'bg-accent text-white',
  teal: 'bg-[#1f6470] text-white',
  plum: 'bg-[#5b4a8a] text-white',
  moss: 'bg-moss text-white',
}

const sizes = { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-20 text-2xl' }

/** 画像を使わず、表示名の頭文字で表すアバター */
export function Avatar({ creator, size = 'md' }: { creator: Pick<CreatorProfile, 'displayName' | 'avatarTone'>; size?: keyof typeof sizes }) {
  const initial = creator.displayName.trim().charAt(0)
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${tones[creator.avatarTone]} ${sizes[size]}`} aria-hidden>
      {initial}
    </span>
  )
}
