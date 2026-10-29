import { ArrowLeft, MessageCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { IdeaCard } from '../components/idea/IdeaCard'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Container } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { db } from '../db/database'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { formatDate } from '../lib/format'
import { CONSULTATION_META } from '../lib/labels'

export default function CreatorPage() {
  const { id = '' } = useParams()
  const creatorQuery = useLiveData(() => db.creators.get(id), [id])
  const { data: ideas } = useLiveData(
    () =>
      db.ideas
        .where('creatorId')
        .equals(id)
        .filter((i) => i.status === 'published' || i.status === 'nondisclosure')
        .toArray(),
    [id],
  )
  const creator = creatorQuery.data
  useDocumentTitle(creator ? `${creator.displayName}さん` : '創作者プロフィール')

  if (creatorQuery.loading) return <Loading />
  if (!creator) {
    return (
      <Container className="py-20">
        <ErrorState title="創作者が見つかりません" action={<ButtonLink to="/ideas" variant="secondary">アイデア一覧へ</ButtonLink>} />
      </Container>
    )
  }
  const consult = CONSULTATION_META[creator.consultation]

  return (
    <>
      <section className="border-b border-line bg-paper">
        <Container className="py-12 sm:py-16">
          <Link to="/ideas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            アイデア一覧
          </Link>
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar creator={creator} size="lg" />
            <div className="flex-1">
              <p className="text-xs font-medium tracking-[0.2em] text-accent">CREATOR</p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{creator.displayName}</h1>
              <p className="mt-2 text-base text-charcoal">{creator.tagline}</p>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
          <div className="space-y-12">
            <section>
              <h2 className="text-lg font-semibold">創作の背景</h2>
              <p className="mt-3 text-[15px] leading-loose">{creator.background}</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold">アイデア制作の考え方</h2>
              <blockquote className="mt-4 border-l-2 border-accent pl-5 text-[15px] leading-loose text-charcoal">{creator.philosophy}</blockquote>
            </section>
            <section>
              <h2 className="text-lg font-semibold">思考スタイル</h2>
              <ol className="mt-4 grid gap-3 sm:grid-cols-3">
                {creator.thinkingStyle.map((s, i) => (
                  <li key={s} className="rounded-lg border border-line p-4">
                    <p className="text-xs text-accent">0{i + 1}</p>
                    <p className="mt-1 font-medium text-ink">{s}</p>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h2 className="text-lg font-semibold">
                この人のアイデア <span className="text-sm font-normal text-muted">{ideas?.length ?? 0}件</span>
              </h2>
              <div className="mt-4">
                {!ideas ? (
                  <Loading />
                ) : ideas.length === 0 ? (
                  <EmptyState title="公開中のアイデアはまだありません" />
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    {ideas.map((idea) => (
                      <IdeaCard key={idea.id} idea={idea} creator={creator} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-line p-6">
              <h2 className="text-base font-semibold">相談受付状態</h2>
              <div className="mt-3">
                <Badge tone={consult.tone}>{consult.label}</Badge>
              </div>
              {creator.consultationNote && <p className="mt-3 text-sm text-muted">{creator.consultationNote}</p>}
              <div className="mt-5">
                {creator.consultation === 'closed' ? (
                  <p className="rounded-md bg-paper px-3 py-2.5 text-center text-sm text-muted">現在、新しい相談は受け付けていません</p>
                ) : (
                  <ButtonLink to={`/connect/${creator.id}`} className="w-full" icon={<MessageCircle className="size-4" aria-hidden />}>
                    相談を申し込む
                  </ButtonLink>
                )}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted">連絡先は、双方が同意するまで開示されません。</p>
            </div>
            <div className="rounded-lg border border-line p-6">
              <h2 className="text-base font-semibold">関心分野</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {creator.interests.map((i) => (
                  <Badge key={i} tone="outline">
                    {i}
                  </Badge>
                ))}
              </div>
              <h2 className="mt-6 text-base font-semibold">公開可能な経歴</h2>
              <p className="mt-2 text-sm text-charcoal">{creator.publicCareer ?? '公開していません'}</p>
              <p className="mt-6 text-xs text-muted">参加日 {formatDate(creator.joinedAt)}</p>
            </div>
          </aside>
        </div>
      </Container>
    </>
  )
}
