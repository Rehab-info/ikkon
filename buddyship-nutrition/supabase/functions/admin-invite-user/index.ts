/**
 * POST /functions/v1/admin-invite-user(API.md §2)
 * 管理者(aal2)が利用者・スタッフを招待し、プロフィールとロールを登録する。
 *  1. 呼出者の JWT で admin_check(管理者でなければここで終わり。service role には触れない)
 *  2. service role で Auth の招待(この関数で service role を使うのはこの操作と、失敗時の取消だけ)
 *  3. 呼出者の JWT で admin_register_profile(組織・拠点の検証と監査は DB 側)
 */
import { z } from 'zod';
import { getCaller } from '../_shared/caller.ts';
import { allowedOrigins, requireEnv } from '../_shared/env.ts';
import { corsHeaders, errorResponse, jsonResponse, readJsonBody, requestIdOf, rpcError } from '../_shared/http.ts';
import { hashUserId, log } from '../_shared/log.ts';
import { createServiceClient } from '../_shared/service-client.ts';

const FN = 'admin-invite-user';

// packages/shared/src/schemas.ts の InviteUserRequest と同じ(Deno 側はこのファイルで完結させる)
const InviteUserRequest = z
  .object({
    email: z.email().max(254),
    display_name: z.string().trim().min(1).max(50),
    role: z.enum(['member', 'staff']),
    facility_id: z.uuid().nullable(),
  })
  .strict();

export async function handler(req: Request): Promise<Response> {
  const started = Date.now();
  const requestId = requestIdOf(req);
  const cors = corsHeaders(req, allowedOrigins());
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

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return done(errorResponse('invalid_request', requestId, cors));

  const caller = await getCaller(req);
  if (!caller) return done(errorResponse('unauthenticated', requestId, cors));
  const userHash = await hashUserId(caller.user.id, requireEnv('LOG_HASH_SALT'));

  const body = await readJsonBody(req, 4096);
  if (!body.ok) return done(errorResponse(body.code, requestId, cors), { user_hash: userHash });
  const input = InviteUserRequest.safeParse(body.value);
  if (!input.success) return done(errorResponse('invalid_request', requestId, cors), { user_hash: userHash });

  // 1. 管理者の確認(拒否は DB 側で監査される)
  const check = await caller.client.rpc('admin_check');
  const checkErr = check.error ? 'internal' : rpcError(check.data);
  if (checkErr) return done(errorResponse(checkErr, requestId, cors), { user_hash: userHash, error_code: checkErr });

  // 2. Auth に招待
  const service = createServiceClient();
  const invited = await service.auth.admin.inviteUserByEmail(input.data.email, {
    redirectTo: requireEnv('SITE_URL'),
  });
  if (invited.error || !invited.data.user) {
    // 既存のメールアドレス等。詳細(メールアドレスの存在)は返さない
    const code = invited.error?.status === 422 ? 'conflict' : 'internal';
    return done(errorResponse(code, requestId, cors), { user_hash: userHash, error_code: code });
  }
  const newUserId = invited.data.user.id;

  // 3. プロフィールとロールの登録(呼出者の権限で)
  const reg = await caller.client.rpc('admin_register_profile', {
    p_user_id: newUserId,
    p_display_name: input.data.display_name,
    p_role: input.data.role,
    p_facility_id: input.data.facility_id,
  });
  const regErr = reg.error ? 'internal' : rpcError(reg.data);
  if (regErr) {
    // 招待だけ残らないように取り消す
    await service.auth.admin.deleteUser(newUserId);
    return done(errorResponse(regErr, requestId, cors), { user_hash: userHash, error_code: regErr });
  }

  return done(jsonResponse({ user_id: newUserId, request_id: requestId }, 201, cors), { user_hash: userHash });
}

if (import.meta.main) {
  Deno.serve(handler);
}
