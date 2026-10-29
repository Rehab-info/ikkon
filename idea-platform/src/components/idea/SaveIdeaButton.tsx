import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useDemoUser } from '../../context/demoUser'
import { useToast } from '../../context/toast'
import { db } from '../../db/database'
import { toggleSavedIdea } from '../../db/repo'
import { useLiveData } from '../../hooks/useLiveData'

export function SaveIdeaButton({ ideaId, title, withLabel = false }: { ideaId: string; title: string; withLabel?: boolean }) {
  const { user } = useDemoUser()
  const { notify } = useToast()
  const { data: saved } = useLiveData(() => db.saved.get(`${user.id}:${ideaId}`), [user.id, ideaId])
  const isSaved = Boolean(saved)
  const Icon = isSaved ? BookmarkCheck : Bookmark
  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? `「${title}」の保存を解除` : `「${title}」を保存`}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const now = await toggleSavedIdea(user.id, ideaId)
        notify(now ? 'マイページに保存しました' : '保存を解除しました', 'info')
      }}
      className={`inline-flex items-center gap-1.5 rounded-md text-sm transition-colors ${
        withLabel ? 'h-10 border border-line-strong px-3 hover:border-ink' : 'size-9 justify-center hover:bg-paper'
      } ${isSaved ? 'text-accent' : 'text-muted hover:text-ink'}`}
    >
      <Icon className="size-4" aria-hidden />
      {withLabel && (isSaved ? '保存済み' : '保存する')}
    </button>
  )
}
