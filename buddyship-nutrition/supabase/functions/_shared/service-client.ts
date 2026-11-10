import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './env.ts';

/**
 * service role クライアント。使ってよいのは次の関数だけ(ARCHITECTURE §4.3、CI で検査):
 *   admin-invite-user / delete-account / purge-expired-images
 * 必ず、呼出者の認可を確認し、操作対象を確定させてから呼ぶこと。
 * 利用者データの読み書きには使わない。
 */
export function createServiceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
