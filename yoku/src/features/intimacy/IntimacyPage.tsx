import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Lock, Plus, Send } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Card, Chip, EmptyState, Notice, Page, Section, SensitiveText, buttonClass } from "../../components/ui";
import { DomainBadge } from "../../components/domains";
import { Tabs } from "../../components/Tabs";
import { href, navigate } from "../../lib/router";
import {
  BOUNDARY_STATUS_LABEL,
  BOUNDARY_STATUS_ORDER,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  PREF_STATUS_LABEL
} from "../../lib/labels";
import { daysBetween, formatJaDate } from "../../lib/date";
import type { IntimacyPreference } from "../../db/types";

type Tab = "preferences" | "memories" | "boundaries";
const TABS: readonly { value: Tab; label: string }[] = [
  { value: "preferences", label: "好み" },
  { value: "memories", label: "良かった体験" },
  { value: "boundaries", label: "境界線" }
];

const STALE_DAYS = 90;

function updatedLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} 更新`;
}

function PreferenceItem({ p, blur }: { p: IntimacyPreference; blur: boolean }) {
  const stale = daysBetween(new Date(p.updatedAt), new Date()) >= STALE_DAYS;
  return (
    <li>
      <a href={href(`/intimacy/preference/${p.id}`)} className="flex items-center gap-3 rounded-2xl px-1 py-2.5 hover:bg-surface-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            <SensitiveText blur={blur}>{p.title}</SensitiveText>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip tone={p.status === "like" || p.status === "curious" ? "accent" : "neutral"}>{PREF_STATUS_LABEL[p.status]}</Chip>
            {!blur && p.tags.map((t) => <Chip key={t}>#{t}</Chip>)}
            <span className="text-[0.7rem] text-muted">{updatedLabel(p.updatedAt)}</span>
          </div>
          {stale && <p className="mt-1 text-[0.7rem] text-muted">しばらく見直していません。今の気持ちと合っていますか？</p>}
        </div>
        <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
      </a>
    </li>
  );
}

export function IntimacyPage({ tab: tabParam }: { tab: string | null }) {
  const { db, settings } = useApp();
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : "preferences";
  const prefs = useLiveQuery(() => db.intimacyPreferences.orderBy("updatedAt").reverse().toArray(), [db]);
  const memories = useLiveQuery(() => db.intimacyMemories.toArray(), [db]);
  const boundaries = useLiveQuery(() => db.intimacyBoundaries.toArray(), [db]);
  const blur = settings.sensitiveBlur;
  if (!prefs || !memories || !boundaries) return null;

  const sortedMemories = [...memories].sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt));

  return (
    <Page title="Intimacy" subtitle="親密さと好みを、自分のために整理する" actions={<DomainBadge domain="intimacy" />}>
      <Notice icon={<Lock size={18} />} tone="caution">
        この領域の記録はすべて非公開で、この端末の中だけにあります。好みは今の気持ちで、いつでも変えられます。
        <strong className="font-semibold">過去の記録や好みが一致していることは、今この瞬間の同意を意味しません。</strong>
      </Notice>

      <div className="mt-5">
        <Tabs label="Intimacy の記録の種類" value={tab} onChange={(v) => navigate(`/intimacy?tab=${v}`, { replace: true })} tabs={TABS} />
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "preferences" && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-2">
              <a href={href("/intimacy/preference/new")} className={buttonClass("primary", true)}>
                <Plus aria-hidden size={18} />
                好みを追加
              </a>
              <a href={href("/share?kind=intimacy")} className={buttonClass("secondary", true)}>
                <Send aria-hidden size={18} />
                選んで伝える
              </a>
            </div>
            {prefs.length === 0 ? (
              <EmptyState title="まだ記録がありません">名前は自由に入力できます。分類とステータスは、あとから何度でも変えられます。</EmptyState>
            ) : (
              CATEGORY_ORDER.map((cat) => {
                const items = prefs.filter((p) => p.category === cat);
                if (items.length === 0) return null;
                return (
                  <Section key={cat} title={CATEGORY_LABEL[cat]}>
                    <Card>
                      <ul className="-my-1 divide-y divide-line">
                        {items.map((p) => (
                          <PreferenceItem key={p.id} p={p} blur={blur} />
                        ))}
                      </ul>
                    </Card>
                  </Section>
                );
              })
            )}
          </>
        )}

        {tab === "memories" && (
          <>
            <a href={href("/intimacy/memory/new")} className={`${buttonClass("primary", true)} mb-5`}>
              <Plus aria-hidden size={18} />
              良かった体験を残す
            </a>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              心地よかったこと・うれしかったことを、自分のために残す場所です。点数をつけたり、相手を評価したりする機能はありません。体験の記録は共有文に入りません。
            </p>
            {sortedMemories.length === 0 ? (
              <EmptyState title="まだ記録がありません" />
            ) : (
              <ul className="space-y-3">
                {sortedMemories.map((m) => (
                  <li key={m.id}>
                    <a href={href(`/intimacy/memory/${m.id}`)} className="block">
                      <Card>
                        <p className="text-xs text-muted">{m.date ? formatJaDate(m.date) : "日付なし"}</p>
                        <p className="mt-0.5 font-medium text-ink">
                          <SensitiveText blur={blur}>{m.title}</SensitiveText>
                        </p>
                        {!blur && m.positiveExperience && <p className="mt-1 line-clamp-2 text-sm text-muted">{m.positiveExperience}</p>}
                      </Card>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "boundaries" && (
          <>
            <a href={href("/intimacy/boundary/new")} className={`${buttonClass("primary", true)} mb-5`}>
              <Plus aria-hidden size={18} />
              希望や境界線を追加
            </a>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              自分の希望を整理するためのメモです。アプリは同意が成立したかどうかを判定しません。気持ちは、その場でいつでも変えてよいものです。
            </p>
            {boundaries.length === 0 ? (
              <EmptyState title="まだ記録がありません">例:「その日の気分で断ってもいい」「新しいことは事前に相談したい」</EmptyState>
            ) : (
              BOUNDARY_STATUS_ORDER.map((s) => {
                const items = boundaries.filter((b) => b.status === s);
                if (items.length === 0) return null;
                return (
                  <Section key={s} title={BOUNDARY_STATUS_LABEL[s]}>
                    <Card>
                      <ul className="-my-1 divide-y divide-line">
                        {items.map((b) => (
                          <li key={b.id}>
                            <a href={href(`/intimacy/boundary/${b.id}`)} className="flex items-center gap-3 px-1 py-3 hover:bg-surface-2">
                              <span className="min-w-0 flex-1 font-medium text-ink">
                                <SensitiveText blur={blur}>{b.title}</SensitiveText>
                              </span>
                              <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </Section>
                );
              })
            )}
          </>
        )}
      </div>
    </Page>
  );
}
