/**
 * Edge Function 用ロガー。許可したキーだけを出力する(SECURITY §8)。
 * 健康データ・画像・食品名・メール・表示名・JWT・AI 応答は出さない。
 * console を直接使うのはこのファイルだけ(lint で他は禁止)。
 */
export const ALLOWED_LOG_KEYS = [
  'event',
  'fn',
  'request_id',
  'status',
  'error_code',
  'duration_ms',
  'user_hash',
  'ai_model',
  'ai_input_tokens',
  'ai_output_tokens',
  // 画像の定期削除の件数(purge-expired-images)
  'enqueued',
  'claimed',
  'done',
  'retry',
  'failed',
] as const;

export type LogKey = (typeof ALLOWED_LOG_KEYS)[number];
export type LogFields = Partial<Record<LogKey, string | number | boolean | null>>;

const MAX_STRING = 100;

/** 許可外のキーと、文字列・数値・真偽値以外の値を捨てる */
export function sanitizeLogFields(fields: Record<string, unknown>): LogFields {
  const out: LogFields = {};
  for (const key of ALLOWED_LOG_KEYS) {
    const v = fields[key];
    if (v === null || typeof v === 'number' || typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'string') out[key] = v.slice(0, MAX_STRING);
  }
  return out;
}

/** 利用者 ID を、ログ用に復元できない短いハッシュにする(ソルトは環境変数) */
export async function hashUserId(userId: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${userId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function log(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>): void {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...sanitizeLogFields(fields) });
  // deno-lint-ignore no-console
  if (level === 'error') console.error(line);
  // deno-lint-ignore no-console
  else console.log(line);
}
