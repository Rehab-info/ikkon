import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { requireEnv } from './env.ts';

/**
 * 呼出者の JWT を付けた Supabase クライアント。RLS・RPC の認可がそのまま効く。
 * 利用者データへのアクセスは原則これを使う(service role は使わない)。
 */
export async function getCaller(req: Request): Promise<{ client: SupabaseClient; user: User } | null> {
  const auth = req.headers.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(auth);
  if (!match) return null;
  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return { client, user: data.user };
}
