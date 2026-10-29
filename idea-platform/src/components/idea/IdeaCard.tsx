import { Link } from 'react-router-dom'
import { formatYen } from '../../lib/format'
import { VALIDATION_STAGE_META } from '../../lib/labels'
import type { CreatorProfile, IdeaPreview } from '../../types'
import { Avatar } from '../ui/Avatar'
import { IdeaStatusBadge } from './IdeaStatusBadge'
import { SaveIdeaButton } from './SaveIdeaButton'

export function IdeaCard({ idea, creator }: { idea: IdeaPreview; creator?: CreatorProfile }) {
  const stage = VALIDATION_STAGE_META[idea.validation.stage]
  return (
    <article className="group relative flex min-w-0 flex-col rounded-lg border border-line bg-white p-6 transition-colors hover:border-ink/40" data-testid="idea-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wider text-accent">{idea.category}</span>
          <IdeaStatusBadge status={idea.status} />
        </div>
        <div className="relative z-10">
          <SaveIdeaButton ideaId={idea.id} title={idea.title} />
        </div>
      </div>
      <h3 className="mt-3 text-[17px] font-semibold leading-snug">
        <Link to={`/ideas/${idea.id}`} className="after:absolute after:inset-0 focus:outline-none focus-visible:underline">
          {idea.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 text-sm text-muted">{idea.catchcopy}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <span className="flex gap-0.5" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1 w-4 rounded-full ${i <= stage.step ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </span>
        <span>{stage.label}</span>
      </div>
      <div className="mt-auto pt-6"><div className="flex items-end justify-between gap-3 border-t border-line pt-4">
        {creator ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar creator={creator} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{creator.displayName}</p>
              <p className="truncate text-xs text-muted">{creator.tagline}</p>
            </div>
          </div>
        ) : (
          <span />
        )}
        <p className="shrink-0 text-sm font-semibold text-ink">{formatYen(idea.price)}</p>
      </div>
      </div>
    </article>
  )
}
