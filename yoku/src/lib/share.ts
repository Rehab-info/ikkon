/**
 * 共有文の下書きをつくる純粋関数。
 *
 * 原則:タイトル・名前・本人が「伝えたいメッセージ」として書いた欄だけを使う。
 * メモ・自由記述・タグ・体験の記録・Wellness の数値・誰と食べたか・場所は、下書きに自動で入れない。
 * 本人は次の画面で自由に書き足せる。
 */
import type {
  BoundaryStatus,
  FoodMemory,
  GratitudeEntry,
  IntimacyBoundary,
  IntimacyPreference,
  IntimacyPreferenceStatus
} from "../db/types";
import { BOUNDARY_STATUS_LABEL, BOUNDARY_STATUS_ORDER, PREF_STATUS_LABEL, PREF_STATUS_ORDER } from "./labels";

export type ShareKind = "feeling" | "intimacy" | "food" | "thanks" | "topic";

export const SENSITIVE_KINDS: readonly ShareKind[] = ["intimacy"];

export function buildFeelingText(feelings: readonly string[], extra?: string): string {
  const lines = [...feelings];
  if (extra?.trim()) lines.push(extra.trim());
  if (lines.length === 0) return "";
  return lines.join("\n");
}

export function buildThanksText(entry: Pick<GratitudeEntry, "reason" | "message" | "recipient">): string {
  if (entry.message?.trim()) return entry.message.trim();
  const reason = entry.reason.trim().replace(/[。.!！]+$/u, "");
  if (/ありがとう/u.test(reason)) return `${reason}。`;
  return `${reason}、ありがとう。`;
}

export function buildFoodText(items: readonly Pick<FoodMemory, "dishName" | "restaurantName">[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) {
    const f = items[0]!;
    const where = f.restaurantName ? `${f.restaurantName}の` : "";
    return `この前食べた${where}${f.dishName}がすごく美味しかった。また一緒に行きたい！`;
  }
  const list = items.map((f) => `・${f.dishName}${f.restaurantName ? `(${f.restaurantName})` : ""}`).join("\n");
  return `また一緒に食べたいものリスト\n${list}\nどれか一緒に行かない？`;
}

export const INTIMACY_INTRO = "自分の気持ちを少し整理してみたので、よかったら聞いてほしいです。";
export const INTIMACY_OUTRO = "これは今の気持ちで、これから変わることもあります。合わせなくて大丈夫なので、あなたの気持ちも聞かせてね。";

export function buildIntimacyText(
  prefs: readonly Pick<IntimacyPreference, "title" | "status">[],
  boundaries: readonly Pick<IntimacyBoundary, "title" | "status">[] = []
): string {
  if (prefs.length === 0 && boundaries.length === 0) return "";
  const parts: string[] = [INTIMACY_INTRO];
  const byStatus = new Map<IntimacyPreferenceStatus, string[]>();
  for (const p of prefs) byStatus.set(p.status, [...(byStatus.get(p.status) ?? []), p.title]);
  for (const s of PREF_STATUS_ORDER) {
    const titles = byStatus.get(s);
    if (titles?.length) parts.push(`【${PREF_STATUS_LABEL[s]}】\n${titles.map((t) => `・${t}`).join("\n")}`);
  }
  const byB = new Map<BoundaryStatus, string[]>();
  for (const b of boundaries) byB.set(b.status, [...(byB.get(b.status) ?? []), b.title]);
  for (const s of BOUNDARY_STATUS_ORDER) {
    const titles = byB.get(s);
    if (titles?.length) parts.push(`【${BOUNDARY_STATUS_LABEL[s]}】\n${titles.map((t) => `・${t}`).join("\n")}`);
  }
  parts.push(INTIMACY_OUTRO);
  return parts.join("\n\n");
}

export function buildTopicText(topic: string): string {
  return `今度ゆっくり話したいこと:「${topic}」`;
}

/** 共有文として送る最終テキストの整形(前後の空白、連続する空行を整える) */
export function normalizeShareText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** OS の共有シートに「文章だけ」を渡す。URL・画像・タイトルは付けない */
export async function shareText(text: string): Promise<ShareResult> {
  const body = normalizeShareText(text);
  const nav = globalThis.navigator as Navigator | undefined;
  if (nav && typeof nav.share === "function") {
    try {
      await nav.share({ text: body });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      return "failed";
    }
  }
  return (await copyText(body)) ? "copied" : "failed";
}

export async function copyText(text: string): Promise<boolean> {
  const body = normalizeShareText(text);
  try {
    if (typeof globalThis.navigator?.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(body);
      return true;
    }
  } catch {
    /* 下の方法を試す */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = body;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function canUseShareSheet(): boolean {
  return typeof globalThis.navigator?.share === "function";
}
