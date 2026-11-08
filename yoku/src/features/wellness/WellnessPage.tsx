import { Suspense, lazy, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, Card, ChoiceGroup, EmptyState, IconButton, Notice, Page, Section, buttonClass, useConfirm, useToast } from "../../components/ui";
import { DomainBadge } from "../../components/domains";
import { addDays, formatJaDate, todayISO } from "../../lib/date";
import { href, navigate } from "../../lib/router";
import { deleteWellness } from "../../db/repo";
import type { WellnessEntry } from "../../db/types";
import { visibleScoreMeta } from "./visibleMetrics";
import { buildTrend, type MetricKey } from "./trend";
// グラフのライブラリは大きいので、Wellness を開いたときだけ読みこむ
const TrendChart = lazy(() => import("./TrendChart").then((m) => ({ default: m.TrendChart })));

export function WellnessSummary({ entry, compact = false }: { entry: WellnessEntry; compact?: boolean }) {
  const { settings } = useApp();
  const metas = visibleScoreMeta(settings);
  const items = [
    ...metas.map((m) => ({ key: m.key, label: m.label, value: entry[m.key] })),
    { key: "sleepHours", label: "睡眠時間", value: entry.sleepHours }
  ];
  return (
    <dl className={compact ? "grid grid-cols-4 gap-x-2 gap-y-2" : "grid grid-cols-4 gap-2"}>
      {items.map((i) => (
        <div key={i.key} className="min-w-0 rounded-xl bg-surface-2 px-2 py-1.5 text-center">
          <dt className="truncate text-[0.65rem] text-muted">{i.label}</dt>
          <dd className={i.value === undefined ? "text-xs text-muted" : "text-base font-semibold tabular-nums text-ink"}>
            {i.value === undefined ? "未回答" : i.key === "sleepHours" ? `${i.value}h` : i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function WellnessPage() {
  const { db, settings } = useApp();
  const toast = useToast();
  const { ask, dialog } = useConfirm();
  const [range, setRange] = useState<"7" | "30">("7");
  const metas = visibleScoreMeta(settings);
  const [metric, setMetric] = useState<MetricKey>("mood");
  const [showAll, setShowAll] = useState(false);
  const today = todayISO();
  const entries = useLiveQuery(
    () => db.wellness.where("date").between(addDays(today, -29), today, true, true).sortBy("date"),
    [db, today]
  );
  if (!entries) return null;
  const todayEntry = entries.find((e) => e.date === today);
  const metricOptions = [
    ...metas.map((m) => ({ value: m.key as MetricKey, label: m.label })),
    { value: "sleepHours" as MetricKey, label: "睡眠時間" }
  ];
  const safeMetric = metricOptions.some((o) => o.value === metric) ? metric : "mood";
  const metricLabel = metricOptions.find((o) => o.value === safeMetric)?.label ?? "";
  const points = buildTrend(entries, safeMetric, Number(range), today);

  return (
    <Page title="Wellness" subtitle="三大欲求と、心身の状態をふりかえる" actions={<DomainBadge domain="wellness" />}>
      {dialog}
      <Section title="今日">
        <Card>
          <p className="mb-3 text-sm text-muted">{formatJaDate(today)}</p>
          {todayEntry ? <WellnessSummary entry={todayEntry} /> : <p className="mb-1 text-sm text-ink">まだ記録していません。</p>}
          <a href={href(`/wellness/edit?date=${today}`)} className={`${buttonClass("primary", true)} mt-4`}>
            {todayEntry ? <Pencil aria-hidden size={18} /> : <Plus aria-hidden size={18} />}
            {todayEntry ? "今日の記録を編集" : "今日の状態を記録する"}
          </a>
        </Card>
      </Section>

      <Section title="推移" description="項目ごとに表示します。合計や総合点は出しません。">
        <Card>
          <ChoiceGroup
            label="期間"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7日" },
              { value: "30", label: "30日" }
            ]}
          />
          <label htmlFor="metric" className="mb-1.5 block text-sm font-medium text-ink">
            項目
          </label>
          <select
            id="metric"
            value={safeMetric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
            className="mb-4 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink"
          >
            {metricOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-surface-2" aria-label="グラフを読みこみ中" />}>
            <TrendChart points={points} label={metricLabel} unit={safeMetric === "sleepHours" ? "時間" : ""} max={safeMetric === "sleepHours" ? 12 : 10} />
          </Suspense>
        </Card>
        <div className="mt-3">
          <Notice>
            記録の変化は、ほかの項目との「関連」を見るためのものです。たとえば睡眠と食欲の関連は研究で報告されていますが、あなたの記録から原因を判断することはできません。
          </Notice>
        </div>
      </Section>

      <Section title="これまでの記録" description="直近30日">
        {entries.length === 0 ? (
          <EmptyState title="まだ記録がありません">気が向いた日に、答えたい項目だけ記録できます。</EmptyState>
        ) : (
          <ul className="space-y-3">
            {[...entries].reverse().slice(0, showAll ? undefined : 7).map((e) => (
              <Card as="li" key={e.id}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{formatJaDate(e.date)}</p>
                  <div className="-mr-2 flex">
                    <IconButton label={`${formatJaDate(e.date)}の記録を編集`} onClick={() => navigate(`/wellness/edit?date=${e.date}`)}>
                      <Pencil aria-hidden size={18} />
                    </IconButton>
                    <IconButton
                      label={`${formatJaDate(e.date)}の記録を削除`}
                      onClick={async () => {
                        if (await ask("この日の記録を削除しますか？", `${formatJaDate(e.date)}の Wellness の記録を削除します。元に戻せません。`)) {
                          await deleteWellness(db, e.id);
                          toast("削除しました");
                        }
                      }}
                    >
                      <Trash2 aria-hidden size={18} />
                    </IconButton>
                  </div>
                </div>
                <WellnessSummary entry={e} compact />
              </Card>
            ))}
          </ul>
        )}
        {entries.length > 7 && (
          <Button variant="ghost" full className="mt-3" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "最近の7件だけ表示" : `30日分をすべて表示(${entries.length}件)`}
          </Button>
        )}
      </Section>
    </Page>
  );
}
