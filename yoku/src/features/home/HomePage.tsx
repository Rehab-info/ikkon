import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Pencil, Plus, Send } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Card, Section, buttonClass } from "../../components/ui";
import { DOMAINS, DomainBadge, type DomainKey } from "../../components/domains";
import { formatJaDate, todayISO } from "../../lib/date";
import { href } from "../../lib/router";
import { WellnessSummary } from "../wellness/WellnessPage";

interface Recent {
  id: string;
  domain: DomainKey;
  title: string;
  date: string;
  to: string;
  at: string;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "こんばんは";
  if (h < 11) return "おはようございます";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

export function HomePage() {
  const { db, settings } = useApp();
  const today = todayISO();
  const data = useLiveQuery(async () => {
    const [todayEntry, foods, thanks, prefs, memories] = await Promise.all([
      db.wellness.where("date").equals(today).first(),
      db.foods.orderBy("date").reverse().limit(20).toArray(),
      db.gratitude.orderBy("date").reverse().limit(20).toArray(),
      db.intimacyPreferences.orderBy("updatedAt").reverse().limit(3).toArray(),
      db.intimacyMemories.orderBy("createdAt").reverse().limit(3).toArray()
    ]);
    const wellnessRecent = await db.wellness.orderBy("date").reverse().limit(3).toArray();
    return { todayEntry, foods, thanks, prefs, memories, wellnessRecent };
  }, [db, today]);
  if (!data) return null;

  const showIntimacy = settings.showIntimacy;
  const recent: Recent[] = [
    ...data.wellnessRecent.map((w) => ({ id: w.id, domain: "wellness" as const, title: "からだと心の記録", date: w.date, to: `/wellness/edit?date=${w.date}`, at: w.updatedAt })),
    ...data.foods.slice(0, 3).map((f) => ({ id: f.id, domain: "food" as const, title: f.dishName, date: f.date, to: `/food/${f.id}`, at: f.updatedAt })),
    ...data.thanks.slice(0, 3).map((g) => ({ id: g.id, domain: "thanks" as const, title: g.reason, date: g.date, to: `/thanks/${g.id}`, at: g.updatedAt })),
    // Intimacy はホームでは内容を出さず、「記録があること」だけを示す
    ...(showIntimacy
      ? [...data.prefs, ...data.memories].slice(0, 2).map((x) => ({
          id: x.id,
          domain: "intimacy" as const,
          title: settings.sensitiveBlur ? "親密さの記録" : x.title,
          date: x.updatedAt.slice(0, 10),
          to: "/intimacy",
          at: x.updatedAt
        }))
      : [])
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  const unsentThanks = data.thanks.filter((g) => !g.shared).slice(0, 2);
  const wantAgain = data.foods.filter((f) => f.wantAgain).slice(0, 2);
  const domains: DomainKey[] = ["wellness", ...(showIntimacy ? (["intimacy"] as const) : []), "food", "thanks"];

  return (
    <div className="fade-in mx-auto w-full max-w-xl px-4 pb-28 pt-5">
      <header className="mb-6">
        <p className="text-sm text-muted">{formatJaDate(today)}</p>
        <h1 tabIndex={-1} className="mt-1 font-serif text-2xl font-semibold text-ink outline-none">
          {greeting()}
        </h1>
        <p className="mt-1 text-sm text-muted">自分を知る。ふたりをもっと知る。</p>
      </header>

      <Section title="今日の自分の状態">
        <Card>
          {data.todayEntry ? (
            <WellnessSummary entry={data.todayEntry} compact />
          ) : (
            <p className="text-sm text-ink">今日はまだ記録していません。答えたい項目だけで大丈夫です。</p>
          )}
          <a href={href(`/wellness/edit?date=${today}`)} className={`${buttonClass(data.todayEntry ? "secondary" : "primary", true)} mt-4`}>
            {data.todayEntry ? <Pencil aria-hidden size={18} /> : <Plus aria-hidden size={18} />}
            {data.todayEntry ? "今日の記録を編集" : "今日の記録をつける"}
          </a>
        </Card>
      </Section>

      <Section title="記録する">
        <ul className="grid grid-cols-2 gap-3">
          {domains.map((k) => {
            const d = DOMAINS[k];
            return (
              <li key={k}>
                <a href={href(d.path)} className="block h-full">
                  <Card className="h-full">
                    <DomainBadge domain={k} />
                    <p className="mt-3 font-semibold text-ink">{d.name}</p>
                    <p className="text-xs font-medium text-muted">{d.ja}</p>
                    <p className="mt-1.5 text-[0.72rem] leading-relaxed text-muted">{d.description}</p>
                  </Card>
                </a>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="パートナーへ伝えたいこと"
        action={
          <a href={href("/together")} className="text-sm text-primary underline-offset-4 hover:underline">
            Together へ
          </a>
        }
      >
        <Card>
          {unsentThanks.length === 0 && wantAgain.length === 0 ? (
            <p className="text-sm text-muted">ありがとうや、また食べたいものを記録すると、ここから伝える文を作れます。</p>
          ) : (
            <ul className="-my-1 divide-y divide-line">
              {unsentThanks.map((g) => (
                <li key={g.id}>
                  <a href={href(`/share?kind=thanks&ids=${g.id}`)} className="flex items-center gap-3 py-3">
                    <DomainBadge domain="thanks" size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.message ?? g.reason}</span>
                    <Send aria-hidden size={16} className="shrink-0 text-muted" />
                  </a>
                </li>
              ))}
              {wantAgain.map((f) => (
                <li key={f.id}>
                  <a href={href(`/share?kind=food&ids=${f.id}`)} className="flex items-center gap-3 py-3">
                    <DomainBadge domain="food" size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">また一緒に:{f.dishName}</span>
                    <Send aria-hidden size={16} className="shrink-0 text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <Section title="最近の記録">
        {recent.length === 0 ? (
          <p className="text-sm text-muted">まだ記録はありません。</p>
        ) : (
          <Card>
            <ul className="-my-1 divide-y divide-line">
              {recent.map((r) => (
                <li key={`${r.domain}-${r.id}`}>
                  <a href={href(r.to)} className="flex items-center gap-3 py-3">
                    <DomainBadge domain={r.domain} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{r.title}</span>
                      <span className="block text-[0.7rem] text-muted">
                        {DOMAINS[r.domain].name}・{formatJaDate(r.date, false)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden size={16} className="shrink-0 text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>
    </div>
  );
}
