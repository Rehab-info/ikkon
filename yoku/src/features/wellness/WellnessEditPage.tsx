import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, Card, Notice, Page, Section, TextField, useToast } from "../../components/ui";
import { ScoreInput } from "./ScoreInput";
import { visibleScoreMeta } from "./visibleMetrics";
import { saveWellness } from "../../db/repo";
import { formatJaDate, isISODate, todayISO } from "../../lib/date";
import { goBack, navigate } from "../../lib/router";
import type { WellnessEntry, WellnessScoreKey } from "../../db/types";

type Scores = Partial<Record<WellnessScoreKey, number>>;

export function WellnessEditPage({ date: dateParam }: { date: string | null }) {
  const { db, settings } = useApp();
  const toast = useToast();
  const [date, setDate] = useState(dateParam && isISODate(dateParam) ? dateParam : todayISO());
  const [scores, setScores] = useState<Scores>({});
  const [sleepHours, setSleepHours] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState<string>();

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    void db.wellness
      .where("date")
      .equals(date)
      .first()
      .then((e: WellnessEntry | undefined) => {
        if (!alive) return;
        const s: Scores = {};
        for (const m of visibleScoreMeta({ showSexualDesire: true })) {
          const v = e?.[m.key];
          if (typeof v === "number") s[m.key] = v;
        }
        setScores(s);
        setSleepHours(e?.sleepHours !== undefined ? String(e.sleepHours) : "");
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [db, date]);

  const metas = visibleScoreMeta(settings);
  const desire = metas.filter((m) => m.group === "desire");
  const state = metas.filter((m) => m.group === "state");

  const sleepNum = sleepHours.trim() === "" ? undefined : Number(sleepHours);
  const sleepInvalid = sleepNum !== undefined && (!Number.isFinite(sleepNum) || sleepNum < 0 || sleepNum > 24);

  async function onSave() {
    if (!isISODate(date) || date > todayISO()) {
      setDateError("今日までの日付を選んでください");
      return;
    }
    if (sleepInvalid) return;
    setSaving(true);
    try {
      const saved = await saveWellness(db, { date, scores, sleepHours: sleepNum });
      toast(saved ? "記録しました" : "すべて未回答のため、この日の記録を空にしました");
      navigate("/wellness");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: WellnessScoreKey) => (v: number | undefined) =>
    setScores((s) => {
      const next = { ...s };
      if (v === undefined) delete next[k];
      else next[k] = v;
      return next;
    });

  return (
    <Page title="今日の状態を記録" eyebrow="Wellness" back="/wellness" subtitle="答えたい項目だけで大丈夫です。">
      <TextField
        label="日付"
        type="date"
        value={date}
        onChange={(v) => {
          setDateError(undefined);
          if (isISODate(v)) setDate(v);
        }}
        error={dateError}
        hint={formatJaDate(date)}
      />
      {loaded && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
        >
          <Section title="三大欲求">
            <Card>
              {desire.map((m) => (
                <ScoreInput key={m.key} label={m.label} low={m.low} high={m.high} hint={m.hint} guide={m.guide} value={scores[m.key]} onChange={set(m.key)} />
              ))}
              {!settings.showSexualDesire && (
                <p className="text-xs text-muted">「性欲」は設定で非表示にしています。</p>
              )}
            </Card>
          </Section>
          <Section title="心身の状態">
            <Card>
              {state.map((m) => (
                <ScoreInput key={m.key} label={m.label} low={m.low} high={m.high} value={scores[m.key]} onChange={set(m.key)} />
              ))}
              <TextField
                label="睡眠時間(時間)"
                type="number"
                inputMode="decimal"
                value={sleepHours}
                onChange={setSleepHours}
                placeholder="例:6.5"
                optional
                error={sleepInvalid ? "0〜24 の数で入れてください" : undefined}
                hint="15分(0.25時間)単位で保存します。空欄は未回答です。"
              />
            </Card>
          </Section>
          <Notice icon={<Moon size={18} />}>
            数値は主観的な目安です。合計点や健康スコアは作りません。気になる不調が続くときは、医療機関に相談してください。
          </Notice>
          <div className="mt-6 flex flex-col gap-2">
            <Button type="submit" full disabled={saving || sleepInvalid}>
              保存する
            </Button>
            <Button variant="ghost" full onClick={() => goBack("/wellness")}>
              やめる
            </Button>
          </div>
        </form>
      )}
    </Page>
  );
}
