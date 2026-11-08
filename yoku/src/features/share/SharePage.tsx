import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Check, Copy, Share2 } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, Card, Checkbox, EmptyState, Notice, Page, TextArea, cx, useToast } from "../../components/ui";
import { FEELING_OPTIONS, PREF_STATUS_LABEL, BOUNDARY_STATUS_LABEL, TOPICS } from "../../lib/labels";
import {
  SENSITIVE_KINDS,
  buildFeelingText,
  buildFoodText,
  buildIntimacyText,
  buildThanksText,
  buildTopicText,
  canUseShareSheet,
  copyText,
  normalizeShareText,
  shareText,
  type ShareKind
} from "../../lib/share";
import { setGratitudeShared } from "../../db/repo";
import { formatJaDate } from "../../lib/date";
import { href, navigate } from "../../lib/router";

const KIND_TITLE: Record<ShareKind, string> = {
  feeling: "今日の気持ちを伝える",
  intimacy: "好みについて話す",
  food: "また食べたいものを伝える",
  thanks: "ありがとうを伝える",
  topic: "話したいテーマを伝える"
};

const STEPS = ["選ぶ", "文章を編集", "確認", "送る"] as const;

function isKind(v: string | null): v is ShareKind {
  return v === "feeling" || v === "intimacy" || v === "food" || v === "thanks" || v === "topic";
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-1.5" aria-label="共有の手順">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === step ? "step" : undefined} className="text-center">
          <span className={cx("mb-1 block h-1 rounded-full", i <= step ? "bg-primary" : "bg-line")} aria-hidden />
          <span className={cx("text-[0.7rem]", i === step ? "font-semibold text-ink" : "text-muted")}>
            {i + 1}. {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SelectRow({
  type,
  name,
  checked,
  onChange,
  title,
  meta
}: {
  type: "checkbox" | "radio";
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  meta?: string;
}) {
  return (
    <li>
      <label
        className={cx(
          "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary",
          checked ? "border-primary bg-primary-soft" : "border-line bg-surface"
        )}
      >
        <input
          type={type}
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--c-primary)]"
        />
        <span className="min-w-0">
          <span className="block text-[0.95rem] text-ink">{title}</span>
          {meta && <span className="block text-xs text-muted">{meta}</span>}
        </span>
      </label>
    </li>
  );
}

export function SharePage({ query }: { query: URLSearchParams }) {
  const { db, settings } = useApp();
  const toast = useToast();
  const kindParam = query.get("kind");
  const kind: ShareKind = isKind(kindParam) ? kindParam : "feeling";
  const presetIds = useMemo(() => (query.get("ids") ?? "").split(",").filter(Boolean), [query]);
  const presetTopic = query.get("topic");

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(kind === "topic" && presetTopic ? [presetTopic] : presetIds);
  const [extra, setExtra] = useState("");
  const [draft, setDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<"shared" | "copied" | null>(null);

  useEffect(() => {
    setStep(0);
    setSelected(kind === "topic" && presetTopic ? [presetTopic] : presetIds);
    setDraft("");
    setConfirmed(false);
    setResult(null);
  }, [kind, presetIds, presetTopic]);

  const prefs = useLiveQuery(() => (kind === "intimacy" ? db.intimacyPreferences.toArray() : []), [db, kind]);
  const boundaries = useLiveQuery(() => (kind === "intimacy" ? db.intimacyBoundaries.toArray() : []), [db, kind]);
  const foods = useLiveQuery(() => (kind === "food" ? db.foods.orderBy("date").reverse().toArray() : []), [db, kind]);
  const thanks = useLiveQuery(() => (kind === "thanks" ? db.gratitude.orderBy("date").reverse().toArray() : []), [db, kind]);

  if (kind === "intimacy" && !settings.showIntimacy) return null;
  if (!prefs || !boundaries || !foods || !thanks) return null;

  const sensitive = SENSITIVE_KINDS.includes(kind);
  const topics = TOPICS.filter((t) => !t.intimacy || settings.showIntimacy);
  const sortedFoods = [...foods].sort((a, b) => Number(!!b.wantAgain) - Number(!!a.wantAgain));

  const toggle = (id: string, on: boolean, single = false) =>
    setSelected((s) => (single ? (on ? [id] : []) : on ? [...new Set([...s, id])] : s.filter((x) => x !== id)));

  function buildDraft(): string {
    switch (kind) {
      case "feeling":
        return buildFeelingText(selected, extra);
      case "intimacy":
        return buildIntimacyText(
          prefs!.filter((p) => selected.includes(`p:${p.id}`)),
          boundaries!.filter((b) => selected.includes(`b:${b.id}`))
        );
      case "food":
        return buildFoodText(foods!.filter((f) => selected.includes(f.id)));
      case "thanks": {
        const g = thanks!.find((t) => selected.includes(t.id));
        return g ? buildThanksText(g) : "";
      }
      case "topic": {
        const t = topics.find((x) => selected.includes(x.id));
        return t ? buildTopicText(t.text) : "";
      }
    }
  }

  const canNext = selected.length > 0 || (kind === "feeling" && extra.trim() !== "");
  const finalText = normalizeShareText(draft);

  async function doShare(how: "share" | "copy") {
    const r = how === "share" ? await shareText(finalText) : (await copyText(finalText)) ? "copied" : "failed";
    if (r === "shared" || r === "copied") {
      setResult(r);
      setStep(3);
      if (r === "copied") toast("コピーしました");
    } else if (r === "failed") toast("共有できませんでした。コピーをお試しください");
  }

  const thanksEntry = kind === "thanks" ? thanks.find((t) => selected.includes(t.id)) : undefined;

  return (
    <Page title={KIND_TITLE[kind]} eyebrow="Together" back="/together">
      <StepIndicator step={step} />

      {step === 0 && (
        <div>
          {kind === "feeling" && (
            <>
              <p className="mb-3 text-sm text-muted">数値ではなく、言葉で伝えます。いくつ選んでも大丈夫です。</p>
              <ul className="mb-4 space-y-2">
                {FEELING_OPTIONS.map((f) => (
                  <SelectRow key={f} type="checkbox" name="feeling" title={f} checked={selected.includes(f)} onChange={(v) => toggle(f, v)} />
                ))}
              </ul>
              <TextArea label="ひとこと添える" optional value={extra} onChange={setExtra} rows={2} />
            </>
          )}

          {kind === "intimacy" && (
            <>
              <Notice tone="caution" icon={<AlertTriangle size={18} />}>
                伝えたい項目だけを選んでください。初期状態では何も選ばれていません。下書きに入るのは<strong>名前とステータスだけ</strong>で、メモ・タグ・体験の記録は入りません。
              </Notice>
              {prefs.length + boundaries.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title="まだ好みや境界線の記録がありません" action={<a className="text-primary underline" href={href("/intimacy/preference/new")}>好みを追加する</a>} />
                </div>
              ) : (
                <>
                  {prefs.length > 0 && <h2 className="mb-2 mt-5 text-sm font-semibold text-ink">好み</h2>}
                  <ul className="space-y-2">
                    {prefs.map((p) => (
                      <SelectRow
                        key={p.id}
                        type="checkbox"
                        name="pref"
                        title={p.title}
                        meta={PREF_STATUS_LABEL[p.status]}
                        checked={selected.includes(`p:${p.id}`)}
                        onChange={(v) => toggle(`p:${p.id}`, v)}
                      />
                    ))}
                  </ul>
                  {boundaries.length > 0 && <h2 className="mb-2 mt-5 text-sm font-semibold text-ink">希望・境界線</h2>}
                  <ul className="space-y-2">
                    {boundaries.map((b) => (
                      <SelectRow
                        key={b.id}
                        type="checkbox"
                        name="boundary"
                        title={b.title}
                        meta={BOUNDARY_STATUS_LABEL[b.status]}
                        checked={selected.includes(`b:${b.id}`)}
                        onChange={(v) => toggle(`b:${b.id}`, v)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {kind === "food" &&
            (foods.length === 0 ? (
              <EmptyState title="まだ食事の記録がありません" action={<a className="text-primary underline" href={href("/food/new")}>記録する</a>} />
            ) : (
              <ul className="space-y-2">
                {sortedFoods.map((f) => (
                  <SelectRow
                    key={f.id}
                    type="checkbox"
                    name="food"
                    title={f.dishName}
                    meta={[formatJaDate(f.date, false), f.restaurantName, f.wantAgain ? "また食べたい" : undefined].filter(Boolean).join("・")}
                    checked={selected.includes(f.id)}
                    onChange={(v) => toggle(f.id, v)}
                  />
                ))}
              </ul>
            ))}

          {kind === "thanks" &&
            (thanks.length === 0 ? (
              <EmptyState title="まだ感謝の記録がありません" action={<a className="text-primary underline" href={href("/thanks/new")}>記録する</a>} />
            ) : (
              <ul className="space-y-2">
                {thanks.map((g) => (
                  <SelectRow
                    key={g.id}
                    type="radio"
                    name="thanks"
                    title={g.reason}
                    meta={[formatJaDate(g.date, false), g.recipient ? `${g.recipient}へ` : undefined].filter(Boolean).join("・")}
                    checked={selected.includes(g.id)}
                    onChange={(v) => toggle(g.id, v, true)}
                  />
                ))}
              </ul>
            ))}

          {kind === "topic" && (
            <ul className="space-y-2">
              {topics.map((t) => (
                <SelectRow key={t.id} type="radio" name="topic" title={t.text} checked={selected.includes(t.id)} onChange={(v) => toggle(t.id, v, true)} />
              ))}
            </ul>
          )}

          <div className="mt-6">
            <Button
              full
              disabled={!canNext}
              onClick={() => {
                setDraft(buildDraft());
                setConfirmed(false);
                setStep(1);
              }}
            >
              下書きを作る
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <TextArea
            label="送る文章"
            value={draft}
            onChange={setDraft}
            rows={10}
            maxLength={4000}
            hint="自由に書き換えてください。ここにある文章だけが送られます。"
          />
          <div className="flex flex-col gap-2">
            <Button full disabled={finalText === ""} onClick={() => setStep(2)}>
              プレビューへ
            </Button>
            <Button variant="ghost" full onClick={() => setStep(0)}>
              選び直す(下書きは作り直されます)
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">送られる内容</h2>
          <Card className="mb-4">
            <p data-testid="share-preview" className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-ink">
              {finalText}
            </p>
            <p className="mt-3 text-right text-xs text-muted">{finalText.length}文字</p>
          </Card>
          <div className="space-y-3">
            {sensitive && (
              <div className="rounded-2xl border border-accent-text/40 bg-accent-soft p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
                  <AlertTriangle aria-hidden size={18} className="text-accent-text" />
                  機微な情報が含まれます
                </p>
                <p className="text-sm leading-relaxed text-ink">
                  性的な好みに関する内容です。送る相手と送り方(アプリ・宛先)をもう一度確かめてください。
                </p>
                <Checkbox label="内容と送り先を確認しました" checked={confirmed} onChange={setConfirmed} />
              </div>
            )}
            <Notice>
              送った内容は、相手の端末やアプリから YOKU で削除・取り消しすることはできません。YOKU は共有したことを記録・通知しません。
            </Notice>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            {canUseShareSheet() && (
              <Button full disabled={sensitive && !confirmed} onClick={() => void doShare("share")}>
                <Share2 aria-hidden size={18} />
                共有する
              </Button>
            )}
            <Button full variant={canUseShareSheet() ? "secondary" : "primary"} disabled={sensitive && !confirmed} onClick={() => void doShare("copy")}>
              <Copy aria-hidden size={18} />
              文章をコピー
            </Button>
            <Button variant="ghost" full onClick={() => setStep(1)}>
              文章を直す
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Check aria-hidden size={28} />
          </div>
          <p className="font-medium text-ink" role="status">
            {result === "copied" ? "文章をコピーしました。メッセージアプリに貼りつけて送れます。" : "共有シートに渡しました。"}
          </p>
          <p className="mt-2 text-sm text-muted">相手の反応を待つ必要はありません。</p>
          {thanksEntry && !thanksEntry.shared && (
            <Button
              variant="soft"
              full
              className="mt-6"
              onClick={async () => {
                await setGratitudeShared(db, thanksEntry.id, true);
                toast("「伝えた」にしました");
              }}
            >
              この感謝に「伝えた」印をつける(任意)
            </Button>
          )}
          <div className="mt-3 flex flex-col gap-2">
            <Button variant="secondary" full onClick={() => navigate("/together")}>
              Together に戻る
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}
