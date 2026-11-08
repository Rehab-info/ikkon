/**
 * Intimacy「もう一度お願いしたい」の共有文。
 *
 * - 〇〇 に入るのは、本人が選んだ(または確認して書き直した)プレイの名前だけ。
 *   メモ・体験の詳細・タグ・ほかの Intimacy の記録は入れない。
 * - 下書き(IntimacyRequestDraft)は画面の一時的な状態としてだけ持ち、保存しない。
 * - これは希望を伝えるきっかけであり、同意を求めたり判定したりするものではない。
 */
import { cleanText, LIMITS } from "./validate";

export type RequestTone = "gentle" | "shy" | "discuss" | "simple";

export interface IntimacyRequestDraft {
  preferenceId?: string;
  memoryId?: string;
  playTitle: string;
  tone: RequestTone;
  message: string;
}

export const REQUEST_TONES: readonly { value: RequestTone; label: string }[] = [
  { value: "gentle", label: "やさしく伝える" },
  { value: "shy", label: "少し照れながら" },
  { value: "discuss", label: "相談したい" },
  { value: "simple", label: "シンプルに" }
];

const TEMPLATES: Record<RequestTone, (t: string) => string> = {
  gentle: (t) => `この前の${t}、すごく嬉しかった。また一緒にできたらいいな♡`,
  shy: (t) => `直接言うのはちょっと恥ずかしいけど、${t}をまたお願いしたいな。`,
  discuss: (t) => `${t}が好きだったから、またできたら嬉しい。どう思う？`,
  simple: (t) => `${t}、またしてみたいな♡`
};

/** 相手が「断ってもいい」と感じられ、返事をしやすくするための結び */
export const REQUEST_CLOSING = "無理に答えなくて大丈夫。気が向いたら相談できたら嬉しいな。";

/** 画面に必ず出す案内 */
export const REQUEST_NOTICE = "これは希望を伝えるメッセージです。実際にするかどうかは、お互いの気持ちを確認して決めましょう。";

/** プレイの名前を整える(改行や前後の空白を除き、長さを制限) */
export function cleanPlayTitle(raw: string): string {
  return (cleanText(raw.replace(/\s+/g, " "), LIMITS.title) ?? "").replace(/^[「『]|[」』]$/g, "");
}

export function buildRequestMessage(playTitle: string, tone: RequestTone, withClosing = true): string {
  const t = cleanPlayTitle(playTitle);
  if (!t) return "";
  const body = TEMPLATES[tone](t);
  return withClosing ? `${body}\n${REQUEST_CLOSING}` : body;
}

export function isRequestTone(v: unknown): v is RequestTone {
  return v === "gentle" || v === "shy" || v === "discuss" || v === "simple";
}

/**
 * 「もう一度お願いしたい」を出す好みかどうか。
 * 体位・プレイ・また体験したいことで、今の気持ちが「今は希望しない」「苦手・避けたい」ではないもの。
 * (以前好きだったことが今も望まれているとは限らないため、本人が今そう思っていないものには出さない)
 */
export function canRequestAgain(p: { category: string; status: string }): boolean {
  return ["play", "position", "again"].includes(p.category) && !["not_now", "avoid"].includes(p.status);
}
