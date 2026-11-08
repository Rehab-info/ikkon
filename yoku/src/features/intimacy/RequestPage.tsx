import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Heart, Share2 } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, Card, Checkbox, ChoiceGroup, EmptyState, Notice, Page, TextArea, TextField, cx, useToast } from "../../components/ui";
import { canUseShareSheet, copyText, normalizeShareText, shareText } from "../../lib/share";
import {
  REQUEST_NOTICE,
  REQUEST_TONES,
  buildRequestMessage,
  canRequestAgain,
  cleanPlayTitle,
  type IntimacyRequestDraft,
  type RequestTone
} from "../../lib/request";
import { PREF_STATUS_LABEL } from "../../lib/labels";
import { navigate } from "../../lib/router";
import { LIMITS } from "../../lib/validate";

const STEPS = ["文章をつくる", "確認", "送る"] as const;

type Source =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "blocked"; reason: string; back: string }
  | { state: "ok"; title: string; back: string; preferenceId?: string; memoryId?: string };

/**
 * 「もう一度お願いしたい」の共有文を作る画面。
 * 下書きはこの画面の状態にだけ置き、IndexedDB には保存しない。共有の記録も残さない。
 */
export function RequestPage({ query }: { query: URLSearchParams }) {
  const { db } = useApp();
  const toast = useToast();
  const preferenceId = query.get("preference") ?? undefined;
  const memoryId = query.get("memory") ?? undefined;
  const [source, setSource] = useState<Source>({ state: "loading" });
  const [draft, setDraft] = useState<IntimacyRequestDraft | null>(null);
  const [withClosing, setWithClosing] = useState(true);
  const [edited, setEdited] = useState(false);
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<"shared" | "copied" | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (preferenceId) {
        const p = await db.intimacyPreferences.get(preferenceId);
        if (!alive) return;
        if (!p) return setSource({ state: "missing" });
        const back = `/intimacy/preference/${p.id}`;
        if (!canRequestAgain(p))
          return setSource({
            state: "blocked",
            back,
            reason: `この好みの今の気持ちは「${PREF_STATUS_LABEL[p.status]}」です。以前の気持ちをもとに、お願いの文章は作りません。`
          });
        setSource({ state: "ok", title: p.title, back, preferenceId: p.id });
      } else if (memoryId) {
        const m = await db.intimacyMemories.get(memoryId);
        if (!alive) return;
        if (!m) return setSource({ state: "missing" });
        setSource({ state: "ok", title: m.title, back: `/intimacy/memory/${m.id}`, memoryId: m.id });
      } else {
        setSource({ state: "missing" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, preferenceId, memoryId]);

  useEffect(() => {
    if (source.state !== "ok") return;
    const playTitle = cleanPlayTitle(source.title);
    setDraft({ preferenceId: source.preferenceId, memoryId: source.memoryId, playTitle, tone: "gentle", message: buildRequestMessage(playTitle, "gentle") });
    setEdited(false);
    setStep(0);
    setConfirmed(false);
    setResult(null);
  }, [source]);

  if (source.state === "loading") return null;
  if (source.state === "missing")
    return (
      <Page title="もう一度お願いしたい" eyebrow="Intimacy" back="/intimacy">
        <EmptyState title="もとの記録が見つかりません" />
      </Page>
    );
  if (source.state === "blocked")
    return (
      <Page title="もう一度お願いしたい" eyebrow="Intimacy" back={source.back}>
        <Notice>{source.reason}</Notice>
      </Page>
    );
  if (!draft) return null;

  /** テンプレート・名前・結びを変えたときは文章を作り直す */
  const regenerate = (patch: Partial<Pick<IntimacyRequestDraft, "playTitle" | "tone">>, closing = withClosing) => {
    const next = { ...draft, ...patch };
    setDraft({ ...next, message: buildRequestMessage(next.playTitle, next.tone, closing) });
    setEdited(false);
  };
  const finalText = normalizeShareText(draft.message);
  const shownTitle = cleanPlayTitle(draft.playTitle);
  const leave = () => navigate(source.back, { replace: true });

  async function doShare(how: "share" | "copy") {
    const r = how === "share" ? await shareText(finalText) : (await copyText(finalText)) ? "copied" : "failed";
    if (r === "shared" || r === "copied") {
      setResult(r);
      setStep(2);
    } else if (r === "cancelled") {
      toast("共有をキャンセルしました。何も送られていません");
    } else {
      toast("共有できませんでした。コピーをお試しください");
    }
  }

  return (
    <Page title="もう一度お願いしたい" eyebrow="Intimacy" back={source.back}>
      <ol className="mb-6 grid grid-cols-3 gap-1.5" aria-label="手順">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="text-center">
            <span className={cx("mb-1 block h-1 rounded-full", i <= step ? "bg-accent-text" : "bg-line")} aria-hidden />
            <span className={cx("text-[0.7rem]", i === step ? "font-semibold text-ink" : "text-muted")}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div>
          <div className="mb-5">
            <Notice icon={<Heart size={18} />} tone="caution">
              {REQUEST_NOTICE}
            </Notice>
          </div>
          <TextField
            label="伝えるときの呼び方"
            value={draft.playTitle}
            maxLength={LIMITS.title}
            onChange={(v) => regenerate({ playTitle: v })}
            hint="文章の「〇〇」に入ります。記録の名前のままでも、伝えやすい言い方に変えてもかまいません。メモや体験の詳細は入りません。"
            error={shownTitle ? undefined : "呼び方を入れてください"}
          />
          <ChoiceGroup<RequestTone>
            label="伝え方"
            value={draft.tone}
            onChange={(v) => regenerate({ tone: v })}
            options={REQUEST_TONES}
            tone="accent"
            hint={edited ? "伝え方を変えると、書き直した文章は新しいテンプレートで作り直されます。" : undefined}
          />
          <div className="mb-2 rounded-2xl border border-line bg-surface px-4 py-1">
            <Checkbox
              label="返事をしやすい一文を添える"
              description="「無理に答えなくて大丈夫。気が向いたら相談できたら嬉しいな。」"
              checked={withClosing}
              onChange={(v) => {
                setWithClosing(v);
                regenerate({}, v);
              }}
            />
          </div>
          <div className="h-3" />
          <TextArea
            label="送る文章"
            value={draft.message}
            onChange={(v) => {
              setDraft({ ...draft, message: v });
              setEdited(true);
            }}
            rows={5}
            maxLength={1000}
            hint="自由に書き換えられます。ここにある文章だけが送られます。"
          />
          <div className="flex flex-col gap-2">
            <Button full disabled={!finalText || !shownTitle} onClick={() => setStep(1)}>
              確認へ進む
            </Button>
            <Button variant="ghost" full onClick={leave}>
              やめる(何も送りません)
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <Card className="mb-4">
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-muted">共有するプレイの名称</dt>
                <dd data-testid="request-title" className="font-medium text-ink">
                  {shownTitle}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">送信する文章</dt>
                <dd data-testid="share-preview" className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-ink">
                  {finalText}
                </dd>
              </div>
            </dl>
          </Card>
          <ul className="mb-4 space-y-2 text-sm leading-relaxed text-ink">
            <li className="flex gap-2">
              <span aria-hidden className="text-accent-text">・</span>送る相手とアプリは、このあと自分で選びます。YOKU が相手を決めたり、自動で送ったりすることはありません。
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent-text">・</span>送った文章は、相手の端末やアプリに残る可能性があります。YOKU から取り消すことはできません。
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent-text">・</span>以前よかったことが、今も望まれているとは限りません。相手には断る自由があり、返事がなくても大丈夫です。
            </li>
          </ul>
          <div className="mb-4">
            <Notice>{REQUEST_NOTICE}</Notice>
          </div>
          <div className="rounded-2xl border border-accent-text/40 bg-accent-soft p-4">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
              <AlertTriangle aria-hidden size={18} className="text-accent-text" />
              機微な情報が含まれます
            </p>
            <Checkbox label="内容と送り先を確認しました" checked={confirmed} onChange={setConfirmed} />
          </div>
          <div className="mt-6 flex flex-col gap-2">
            {canUseShareSheet() && (
              <Button full disabled={!confirmed} onClick={() => void doShare("share")}>
                <Share2 aria-hidden size={18} />
                共有する
              </Button>
            )}
            <Button full variant={canUseShareSheet() ? "secondary" : "primary"} disabled={!confirmed} onClick={() => void doShare("copy")}>
              <Copy aria-hidden size={18} />
              文章をコピー
            </Button>
            <Button variant="ghost" full onClick={() => setStep(0)}>
              文章を直す
            </Button>
            <Button variant="ghost" full onClick={leave}>
              送らずにやめる
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <Check aria-hidden size={28} />
          </div>
          <p role="status" className="font-medium text-ink">
            {result === "copied" ? "文章をコピーしました。送りたいアプリに貼りつけて送れます。" : "共有シートに渡しました。"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            返事を待ったり、催促したりする必要はありません。実際にするかどうかは、その時のふたりの気持ちで決めてください。
          </p>
          <Button variant="secondary" full className="mt-6" onClick={leave}>
            記録に戻る
          </Button>
        </div>
      )}
    </Page>
  );
}
