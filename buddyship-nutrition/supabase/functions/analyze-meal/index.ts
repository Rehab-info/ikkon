/**
 * POST /functions/v1/analyze-meal(docs/API.md §2)
 * 食事の写真から料理・食材と提供量の候補を出し、日本食品標準成分表の食品コードに対応付ける。保存はしない。
 *  1. 呼出者の JWT で:書き込み権限(本人 or meals:write の担当スタッフ)と AI 利用量の上限
 *  2. 呼出者の JWT で画像を取得(Storage のポリシーが効く)、中身を検証
 *  3. AI(D-01 決定までは mock)→ スキーマ検証(栄養値・診断・助言は受け取らない)
 *  4. 食品コードの照合 → packages/nutrition の initialMatchStatus で確定/要確認(D-19)
 *  5. 解析記録を保存(食品名と提供量だけ)
 * service role は使わない。
 */
import { z } from 'zod';
import { getCaller } from '../_shared/caller.ts';
import { allowedOrigins, requireEnv } from '../_shared/env.ts';
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  readJsonBody,
  requestIdOf,
  rpcError,
  type ErrorCode,
} from '../_shared/http.ts';
import { hashUserId, log } from '../_shared/log.ts';
import { checkImage } from '../_shared/image.ts';
import { AiMealResult } from '../_shared/ai/schema.ts';
import { selectAdapter } from '../_shared/ai/index.ts';
import { initialMatchStatus } from '../_shared/nutrition/index.ts';

const FN = 'analyze-meal';
const Body = z
  .object({
    member_id: z.uuid(),
    image_path: z.string().regex(/^[0-9a-f-]{36}\/\d{4}\/[0-9a-f-]{36}\.(webp|jpg)$/),
  })
  .strict();

interface Candidate {
  food_id: string;
  food_code: string;
  display_name: string;
  exact_match: boolean;
  per100: unknown;
}

export async function handler(req: Request): Promise<Response> {
  const started = Date.now();
  const requestId = requestIdOf(req);
  const cors = corsHeaders(req, allowedOrigins());
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
  const fail = (code: ErrorCode) => done(errorResponse(code, requestId, cors), { error_code: code });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail('invalid_request');

  const caller = await getCaller(req);
  if (!caller) return fail('unauthenticated');
  ctx.userHash = await hashUserId(caller.user.id, requireEnv('LOG_HASH_SALT'));

  const body = await readJsonBody(req, 2048);
  if (!body.ok) return fail(body.code);
  const input = Body.safeParse(body.value);
  if (!input.success) return fail('invalid_request');
  const { member_id, image_path } = input.data;
  if (!image_path.startsWith(`${member_id}/`)) return fail('invalid_request');

  // 1. 権限と上限(拒否は DB 側で監査される)
  const auth = await caller.client.rpc('authorize_meal_write', { p_member_id: member_id });
  const authErr = auth.error ? 'internal' : rpcError(auth.data);
  if (authErr) return fail(authErr);
  const adapter = selectAdapter(Deno.env.get('AI_PROVIDER'));
  if (!adapter) return fail('ai_disabled');
  const quota = await caller.client.rpc('consume_ai_quota', { p_member_id: member_id });
  const quotaErr = quota.error ? 'internal' : rpcError(quota.data);
  if (quotaErr) return fail(quotaErr);

  // 2. 画像(呼出者の権限で取得)
  const dl = await caller.client.storage.from('meal-images').download(image_path);
  if (dl.error || !dl.data) return fail('not_found');
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  const img = checkImage(bytes);
  const record = (status: string, items: unknown, error_code: string | null) =>
    caller.client.rpc('record_meal_analysis', {
      p_member_id: member_id,
      p_image_path: image_path,
      p_status: status,
      p_provider: adapter.provider,
      p_model: adapter.model,
      p_items: items,
      p_error_code: error_code,
    });
  if (!img.ok) {
    await record('rejected', null, img.code);
    return fail(img.code);
  }

  // 3. AI
  let raw: unknown;
  try {
    raw = await adapter.analyzeMealImage(bytes, img.mime);
  } catch {
    await record('failed', null, 'ai_error');
    return fail('internal');
  }
  const parsed = AiMealResult.safeParse(raw);
  if (!parsed.success) {
    await record('failed', null, 'schema');
    return fail('internal');
  }
  const ai = parsed.data;

  // 4. 照合
  const labels = ai.items.flatMap((it) => (it.kind === 'food' ? [it.label] : it.components.map((c) => c.label)));
  const matches = new Map<string, Candidate[]>();
  if (labels.length > 0) {
    const m = await caller.client.rpc('match_foods', { p_labels: labels, p_limit: 5 });
    if (m.error || rpcError(m.data)) return fail('internal');
    for (const row of (m.data as { data: { label: string; candidates: Candidate[] }[] }).data)
      matches.set(row.label, row.candidates);
  }
  const line = (label: string, served_g: number, confidence: 'low' | 'medium' | 'high') => {
    const candidates = matches.get(label) ?? [];
    const status = initialMatchStatus(
      candidates.map((c) => ({ foodCode: c.food_code, exactMatch: c.exact_match })),
      confidence,
    );
    return {
      ai_label: label,
      ai_estimated_served_g: served_g,
      confidence,
      match_status: status,
      food: status === 'confirmed' ? candidates[0] : null,
      candidates,
    };
  };
  const items = ai.items.map((it) =>
    it.kind === 'food'
      ? { kind: 'food' as const, ...line(it.label, it.served_g, it.confidence) }
      : {
          kind: 'dish' as const,
          dish_label: it.label,
          composition_known: it.composition_known,
          components: it.components.map((c) => ({ role: c.role, ...line(c.label, c.served_g, c.confidence) })),
        },
  );

  // 5. 解析記録(AI の出力そのまま:食品名と提供量だけ)
  const rec = await record('succeeded', ai, null);
  if (rec.error || rpcError(rec.data)) return fail('internal');
  const analysisId = (rec.data as { data: { analysis_id: string } }).data.analysis_id;

  return done(
    jsonResponse(
      {
        analysis_id: analysisId,
        provider: adapter.provider,
        is_estimate: true,
        is_food_image: ai.is_food_image,
        items,
        request_id: requestId,
      },
      200,
      cors,
    ),
    { ai_model: adapter.model },
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
