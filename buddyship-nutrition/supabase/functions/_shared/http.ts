/** Edge Function 共通の HTTP 応答(API.md §1 のエラー形式) */
export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'conflict'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'ai_disabled'
  | 'internal';

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  quota_exceeded: 429,
  ai_disabled: 503,
  internal: 500,
};

export function statusOf(code: ErrorCode): number {
  return STATUS[code];
}

/** 許可するオリジン(環境変数 ALLOWED_ORIGINS、カンマ区切り)。一致しなければ CORS ヘッダを付けない */
export function corsHeaders(req: Request, allowedOrigins: readonly string[]): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function jsonResponse(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } });
}

/** 内部情報を含めないエラー応答 */
export function errorResponse(code: ErrorCode, requestId: string, extra: Record<string, string> = {}): Response {
  return jsonResponse({ error: { code, request_id: requestId } }, statusOf(code), extra);
}

/** 本文を上限付きで JSON として読む */
export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; code: ErrorCode }> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) return { ok: false, code: 'unsupported_media_type' };
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return { ok: false, code: 'payload_too_large' };
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength > maxBytes) return { ok: false, code: 'payload_too_large' };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { ok: false, code: 'invalid_request' };
  }
}

/** 呼出元の request id(英数字と - のみ)。なければ作る */
export function requestIdOf(req: Request): string {
  const given = req.headers.get('x-request-id');
  return given && /^[A-Za-z0-9-]{8,64}$/.test(given) ? given : crypto.randomUUID();
}

/** RPC の {ok, data} / {ok:false, error} を判定する */
export function rpcError(raw: unknown): ErrorCode | null {
  if (typeof raw === 'object' && raw !== null && 'ok' in raw) {
    const r = raw as { ok: unknown; error?: unknown };
    if (r.ok === true) return null;
    const known: readonly string[] = Object.keys(STATUS);
    return typeof r.error === 'string' && known.includes(r.error) ? (r.error as ErrorCode) : 'internal';
  }
  return 'internal';
}
