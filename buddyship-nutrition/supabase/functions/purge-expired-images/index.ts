/**
 * POST /functions/v1/purge-expired-images(定期実行用。利用者の画面からは呼ばない)
 *  - 保存から 30 日を過ぎた食事の画像、食事に保存されなかった画像(24 時間経過)を Storage から物理削除する
 *  - 対象の選定・再試行・監査は DB(claim_image_purge / report_image_purge)。この関数は Storage の削除だけを行う
 *  - 呼び出しには x-purge-secret ヘッダ(環境変数 PURGE_JOB_SECRET)が必要。利用者の JWT では実行できない
 *  - service role はこの関数で claim / report の RPC と Storage の削除にだけ使う(SECURITY §15)
 */
import { createServiceClient } from '../_shared/service-client.ts';
import { requireEnv } from '../_shared/env.ts';
import { errorResponse, jsonResponse, requestIdOf, rpcError } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import { safeEqual } from '../_shared/secret.ts';

const FN = 'purge-expired-images';
const BATCH = 50;
const MAX_BATCHES = 20; // 1 回の実行で最大 1,000 件

type Claimed = { name: string; reason: 'expired' | 'orphan'; attempt: number };

export async function handler(req: Request): Promise<Response> {
  const started = Date.now();
  const requestId = requestIdOf(req);
  const done = (res: Response, extra: Record<string, unknown> = {}) => {
    log(res.status >= 500 ? 'error' : 'info', {
      fn: FN,
      request_id: requestId,
      status: res.status,
      duration_ms: Date.now() - started,
      ...extra,
    });
    return res;
  };
  if (req.method !== 'POST') return done(errorResponse('invalid_request', requestId));
  const secret = requireEnv('PURGE_JOB_SECRET');
  if (secret.length < 32 || !safeEqual(req.headers.get('x-purge-secret') ?? '', secret)) {
    return done(errorResponse('forbidden', requestId));
  }

  const service = createServiceClient();
  const totals = { enqueued: 0, claimed: 0, done: 0, retry: 0, failed: 0 };
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const claim = await service.rpc('claim_image_purge', { p_limit: BATCH });
    if (claim.error || rpcError(claim.data)) return done(errorResponse('internal', requestId), { error_code: 'claim' });
    const data = (claim.data as { data: { enqueued: number; items: Claimed[] } }).data;
    totals.enqueued += data.enqueued;
    totals.claimed += data.items.length;
    if (data.items.length === 0) break;

    // まとめて削除。存在しない画像の削除はエラーにならない(すでに消えていれば目的は達成)
    const names = data.items.map((i) => i.name);
    const removed = await service.storage.from('meal-images').remove(names);
    const error = removed.error ? 'storage_error' : null;
    const results = names.map((name) => (error ? { name, ok: false, error } : { name, ok: true }));

    const report = await service.rpc('report_image_purge', { p_results: results });
    if (report.error || rpcError(report.data))
      return done(errorResponse('internal', requestId), { error_code: 'report' });
    const r = (report.data as { data: { done: number; retry: number; failed: number } }).data;
    totals.done += r.done;
    totals.retry += r.retry;
    totals.failed += r.failed;
    if (data.items.length < BATCH) break;
  }
  // 画像のパス(利用者 ID を含む)はログに出さない。件数だけ
  return done(jsonResponse({ data: totals }, 200), totals);
}

if (import.meta.main) {
  Deno.serve(handler);
}
