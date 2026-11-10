/**
 * GET /functions/v1/meal-image?meal_id=...(本人だけ。D-09)
 * 呼出者の JWT で閲覧の可否を確かめ(許可・拒否を監査に残す)、Storage のポリシーの下で画像を取得して返す。
 * service role は使わない。端末にキャッシュさせない。
 */
import { getCaller } from '../_shared/caller.ts';
import { allowedOrigins, requireEnv } from '../_shared/env.ts';
import { corsHeaders, errorResponse, requestIdOf, rpcError } from '../_shared/http.ts';
import { hashUserId, log } from '../_shared/log.ts';
import { checkImage } from '../_shared/image.ts';

const FN = 'meal-image';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function handler(req: Request): Promise<Response> {
  const started = Date.now();
  const requestId = requestIdOf(req);
  const cors = { ...corsHeaders(req, allowedOrigins()), 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
  const ctx: { userHash?: string } = {};
  const done = (res: Response, extra: Record<string, unknown> = {}) => {
    log(res.status >= 500 ? 'error' : 'info', {
      fn: FN,
      request_id: requestId,
      status: res.status,
      duration_ms: Date.now() - started,
      user_hash: ctx.userHash,
      ...extra,
    });
    return res;
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return done(errorResponse('invalid_request', requestId, cors));

  const caller = await getCaller(req);
  if (!caller) return done(errorResponse('unauthenticated', requestId, cors));
  ctx.userHash = await hashUserId(caller.user.id, requireEnv('LOG_HASH_SALT'));

  const mealId = new URL(req.url).searchParams.get('meal_id') ?? '';
  if (!UUID.test(mealId)) return done(errorResponse('invalid_request', requestId, cors));

  const auth = await caller.client.rpc('authorize_meal_image', { p_meal_id: mealId });
  const authErr = auth.error ? 'internal' : rpcError(auth.data);
  if (authErr) return done(errorResponse(authErr, requestId, cors), { error_code: authErr });
  const path = (auth.data as { data: { image_path: string } }).data.image_path;

  const dl = await caller.client.storage.from('meal-images').download(path);
  if (dl.error || !dl.data) return done(errorResponse('not_found', requestId, cors));
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  const img = checkImage(bytes);
  if (!img.ok) return done(errorResponse('not_found', requestId, cors));
  return done(
    new Response(bytes, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': img.mime,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    }),
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
