/**
 * RPC・Edge Function が返すエラーコード。
 * DB 側(supabase/migrations/*_rpc.sql の private.err / private.deny)と一致させる。
 */
export const ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'invalid_request',
  'conflict',
  'rate_limited',
  'quota_exceeded',
  'ai_disabled',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** 画面に出す文。何が起きたかと、次にどうすればよいかを平易に書く(SCREENS §1) */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  unauthenticated: 'ログインの有効期限が切れました。もう一度ログインしてください。',
  forbidden: 'この操作はできません。担当や共有の設定が変わった可能性があります。',
  not_found: '見つかりませんでした。',
  invalid_request: '入力内容を確かめてください。',
  conflict: 'すでに登録されています。',
  rate_limited: '続けて操作が行われました。少し待ってから、もう一度お試しください。',
  quota_exceeded: '今日の写真の解析回数の上限に達しました。手で記録できます。',
  ai_disabled: '写真の解析は今お休みしています。手で記録できます。',
  internal: 'うまくいきませんでした。時間をおいて、もう一度お試しください。',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
  }
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
