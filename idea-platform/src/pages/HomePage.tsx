import { ArrowRight, ChevronDown, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IdeaCard } from '../components/idea/IdeaCard'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Container } from '../components/ui/PageHeader'
import { Loading } from '../components/ui/States'
import { BRAND_MESSAGE, CONNECTION_STEPS, FAQ, FLOW_STEPS, HERO, PATHS } from '../content/copy'
import { db } from '../db/database'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { CONSULTATION_META } from '../lib/labels'

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="mb-3 text-xs font-medium tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 className="text-2xl font-semibold sm:text-[28px]">{title}</h2>
      {lead && <p className="mt-3 text-[15px] text-muted">{lead}</p>}
    </div>
  )
}

/** ヒーローの図：アイデアから人へつながる様子を静かな線で表す */
function HeroDiagram() {
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full max-w-sm" role="img" aria-label="アイデアと人がつながる構造を表す図">
      <g fill="none" stroke="#cfd3d9" strokeWidth="1">
        <path d="M180 60 L80 150" />
        <path d="M180 60 L280 150" />
        <path d="M80 150 L180 240" />
        <path d="M280 150 L180 240" />
        <path d="M180 60 L180 240" strokeDasharray="3 4" />
      </g>
      <g>
        <rect x="120" y="36" width="120" height="48" rx="4" fill="#ffffff" stroke="#14213d" />
        <text x="180" y="65" textAnchor="middle" fontSize="13" fill="#14213d">アイデア</text>
        <rect x="24" y="128" width="112" height="44" rx="4" fill="#ffffff" stroke="#cfd3d9" />
        <text x="80" y="155" textAnchor="middle" fontSize="12" fill="#5f6670">課題</text>
        <rect x="224" y="128" width="112" height="44" rx="4" fill="#ffffff" stroke="#cfd3d9" />
        <text x="280" y="155" textAnchor="middle" fontSize="12" fill="#5f6670">検証</text>
        <circle cx="180" cy="240" r="26" fill="#14213d" />
        <text x="180" y="245" textAnchor="middle" fontSize="12" fill="#ffffff">人</text>
      </g>
      <circle cx="180" cy="60" r="3" fill="#8a6a2f" transform="translate(0 -24)" />
    </svg>
  )
}

export default function HomePage() {
  useDocumentTitle('')
  const { data: ideas } = useLiveData(
    () => db.ideas.where('status').anyOf(['published', 'nondisclosure']).toArray(),
    [],
  )
  const { data: creators } = useLiveData(() => db.creators.toArray(), [])
  const featured = (ideas ?? []).filter((i) => i.status === 'published').sort((a, b) => b.featuredScore - a.featuredScore).slice(0, 3)
  const creatorById = new Map((creators ?? []).map((c) => [c.id, c]))

  return (
    <>
      {/* ヒーロー */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="mb-6 text-[11px] font-medium tracking-[0.22em] text-accent">{HERO.eyebrow}</p>
            <h1 className="text-[34px] font-semibold leading-[1.35] tracking-wide sm:text-5xl sm:leading-[1.3]">{HERO.title}</h1>
            <p className="mt-6 max-w-xl text-base leading-loose text-muted sm:text-lg">{HERO.subtitle}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/ideas" size="lg" icon={<ArrowRight className="size-4" aria-hidden />} className="flex-row-reverse">
                {HERO.primaryCta}
              </ButtonLink>
              <ButtonLink to="/workspace" size="lg" variant="secondary">
                {HERO.secondaryCta}
              </ButtonLink>
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <HeroDiagram />
          </div>
        </Container>
      </section>

      {/* ブランドメッセージ */}
      <section className="bg-paper">
        <Container className="py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">{BRAND_MESSAGE.title}</h2>
            <div className="mt-8 space-y-5 text-[15px] leading-loose text-charcoal sm:text-base">
              {BRAND_MESSAGE.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* 2つの導線 */}
      <section>
        <Container className="py-20 sm:py-24">
          <div className="grid gap-6 md:grid-cols-2">
            {PATHS.map((p) => (
              <div key={p.key} className="flex flex-col rounded-lg border border-line p-8 sm:p-10">
                <p className="text-sm text-muted">{p.lead}</p>
                <h2 className="mt-2 text-2xl font-semibold">{p.title}</h2>
                <ul className="mt-6 space-y-3 text-[15px]">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-3">
                      <span className="mt-[11px] h-px w-4 shrink-0 bg-accent" aria-hidden />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <ButtonLink to={p.to} variant={p.key === 'find' ? 'primary' : 'secondary'}>
                    {p.cta}
                    <ArrowRight className="size-4" aria-hidden />
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* つながる仕組み */}
      <section className="border-y border-line bg-paper">
        <Container className="py-20 sm:py-24">
          <SectionHeading
            eyebrow="HOW CONNECTION WORKS"
            title="アイデアの先にいる、人とつながる仕組み"
            lead="アイデアを読んで「この人と話してみたい」と感じたら、相談を申し込めます。対話や協働は、双方が同意した場合にのみ始まります。"
          />
          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {CONNECTION_STEPS.map((s, i) => (
              <li key={s.title} className="bg-white p-6">
                <p className="text-xs font-medium text-accent">STEP {i + 1}</p>
                <p className="mt-2 font-semibold text-ink">{s.title}</p>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-start gap-2 text-sm text-muted">
            <Lock className="mt-1 size-4 shrink-0" aria-hidden />
            アイデアの購入によって、創作者の労務や協働が保証されることはありません。連絡先は同意前に開示されません。
          </p>
        </Container>
      </section>

      {/* 注目アイデア */}
      <section>
        <Container className="py-20 sm:py-24">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow="FEATURED IDEAS" title="注目のアイデア" />
            <Link to="/ideas" className="inline-flex items-center gap-1.5 text-sm text-ink underline-offset-4 hover:underline">
              すべてのアイデアを見る
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {!ideas ? (
            <Loading />
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} creator={creatorById.get(idea.creatorId)} />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* 利用の流れ */}
      <section className="border-t border-line">
        <Container className="py-20 sm:py-24">
          <SectionHeading eyebrow="HOW IT WORKS" title="サービス利用の流れ" />
          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            {(
              [
                ['アイデアを探す方', FLOW_STEPS.buyer],
                ['アイデアを生み出す方', FLOW_STEPS.creator],
              ] as const
            ).map(([label, steps]) => (
              <div key={label}>
                <h3 className="text-base font-semibold">{label}</h3>
                <ol className="mt-6 space-y-0">
                  {steps.map((s, i) => (
                    <li key={s.title} className="relative flex gap-5 pb-8 last:pb-0">
                      {i < steps.length - 1 && <span className="absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px bg-line" aria-hidden />}
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ink text-xs font-medium text-ink">{i + 1}</span>
                      <div className="pt-1">
                        <p className="font-medium text-ink">{s.title}</p>
                        <p className="mt-1 text-sm text-muted">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* 創作者紹介 */}
      <section className="border-t border-line bg-paper">
        <Container className="py-20 sm:py-24">
          <SectionHeading
            eyebrow="CREATORS"
            title="アイデアを生み出す人たち"
            lead="肩書きではなく、何に目を向け、どう考えてきたか。アイデアの背景にある、その人の視点を紹介します。"
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(creators ?? []).map((c) => {
              const consult = CONSULTATION_META[c.consultation]
              return (
                <Link key={c.id} to={`/creators/${c.id}`} className="group flex flex-col rounded-lg border border-line bg-white p-6 transition-colors hover:border-ink/40">
                  <div className="flex items-center gap-3">
                    <Avatar creator={c} />
                    <div>
                      <p className="font-medium text-ink group-hover:underline">{c.displayName}</p>
                      <Badge tone={consult.tone}>{consult.label}</Badge>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-charcoal">{c.tagline}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.thinkingStyle.map((s) => (
                      <span key={s} className="rounded border border-line px-2 py-0.5 text-xs text-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section>
        <Container className="py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <SectionHeading eyebrow="FAQ" title="よくある質問" />
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="mt-1 size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-charcoal">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
