import { Search, SearchX } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IdeaCard } from '../components/idea/IdeaCard'
import { Button } from '../components/ui/Button'
import { Container, PageHeader } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { db } from '../db/database'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { VALIDATION_STAGE_META } from '../lib/labels'
import { IDEA_CATEGORIES, type Idea } from '../types'

const SORTS = {
  featured: { label: '注目度順', fn: (a: Idea, b: Idea) => b.featuredScore - a.featuredScore },
  newest: { label: '新着順', fn: (a: Idea, b: Idea) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') },
  validation: {
    label: '検証が進んでいる順',
    fn: (a: Idea, b: Idea) => VALIDATION_STAGE_META[b.validation.stage].step - VALIDATION_STAGE_META[a.validation.stage].step,
  },
  priceAsc: { label: '価格の安い順', fn: (a: Idea, b: Idea) => a.price - b.price },
} as const
type SortKey = keyof typeof SORTS

/** 一覧に表示する公開状態（審査中・下書きなどは表示しない） */
const LISTED_STATUSES = ['published', 'nondisclosure'] as const

export default function IdeasPage() {
  useDocumentTitle('アイデアを探す')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const sort = (params.get('sort') as SortKey) in SORTS ? (params.get('sort') as SortKey) : 'featured'
  const onlyAvailable = params.get('available') === '1'
  const searchId = useId()
  const sortId = useId()

  const ideasQuery = useLiveData(() => db.ideas.where('status').anyOf([...LISTED_STATUSES]).toArray(), [])
  const { data: creators } = useLiveData(() => db.creators.toArray(), [])
  const creatorById = useMemo(() => new Map((creators ?? []).map((c) => [c.id, c])), [creators])

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const results = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    return (ideasQuery.data ?? [])
      .filter((idea) => !category || idea.category === category)
      .filter((idea) => !onlyAvailable || idea.status === 'published')
      .filter((idea) => {
        if (!keyword) return true
        const creator = creatorById.get(idea.creatorId)
        const haystack = [idea.title, idea.catchcopy, idea.summary, idea.problem, idea.category, ...idea.tags, creator?.displayName ?? '']
          .join(' ')
          .toLowerCase()
        return keyword.split(/\s+/).every((w) => haystack.includes(w))
      })
      .sort(SORTS[sort].fn)
  }, [ideasQuery.data, q, category, onlyAvailable, sort, creatorById])

  return (
    <Container className="py-12 sm:py-16">
      <PageHeader
        eyebrow="IDEAS"
        title="アイデアを探す"
        description="課題・想定顧客・検証状況は購入前に確認できます。核心となる内容は、購入後の納品物でのみ開示されます。"
      />

      <div className="mt-8 space-y-5">
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <label htmlFor={searchId} className="sr-only">
            キーワードで検索
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id={searchId}
              type="search"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="キーワード（例：介護、地域、教育）"
              className="h-11 w-full rounded-md border border-line-strong bg-white pr-3 pl-9 text-[15px] focus:border-ink focus:ring-1 focus:ring-ink focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={sortId} className="shrink-0 text-sm text-muted">
              並び替え
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'featured' ? '' : e.target.value })}
              className="h-11 rounded-md border border-line-strong bg-white px-3 text-sm focus:border-ink focus:outline-none"
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="カテゴリーで絞り込み">
            {['', ...IDEA_CATEGORIES].map((c) => {
              const active = category === c
              return (
                <button
                  key={c || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ category: c })}
                  className={`h-9 shrink-0 rounded-full border px-4 text-sm transition-colors ${
                    active ? 'border-ink bg-ink text-white' : 'border-line-strong text-charcoal hover:border-ink'
                  }`}
                >
                  {c || 'すべて'}
                </button>
              )
            })}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => update({ available: e.target.checked ? '1' : '' })}
              className="size-4 accent-ink"
            />
            購入受付中のみ
          </label>
        </div>
      </div>

      <div className="mt-8">
        {ideasQuery.error ? (
          <ErrorState message="アイデアを読み込めませんでした。再読み込みしてください。" />
        ) : ideasQuery.loading ? (
          <Loading />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="条件に合うアイデアが見つかりませんでした"
            description="キーワードを変えるか、絞り込みを解除してお試しください。"
            action={
              <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                条件をリセット
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted" aria-live="polite" data-testid="result-count">
              {results.length}件のアイデア
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} creator={creatorById.get(idea.creatorId)} />
              ))}
            </div>
          </>
        )}
      </div>
    </Container>
  )
}
