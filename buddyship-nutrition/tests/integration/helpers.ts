import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { totp } from './totp.ts';

export const env = () => ({
  url: process.env['IT_SUPABASE_URL']!,
  anon: process.env['IT_ANON_KEY']!,
  service: process.env['IT_SERVICE_ROLE_KEY']!,
  db: process.env['IT_DB_URL']!,
  functions: process.env['IT_FUNCTIONS_URL']!,
});

export const ORG_A = '00000000-0000-4000-8000-000000000001';
const PASSWORD = 'Test-only-1234';

export function anonClient(): SupabaseClient {
  return createClient(env().url, env().anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** テスト用ユーザーを Auth に作る(架空のメールアドレス) */
export async function createAuthUser(label: string): Promise<{ id: string; email: string }> {
  const admin = createClient(env().url, env().service, { auth: { persistSession: false } });
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  return { id: data.user.id, email };
}

/** 最初の管理者だけは SQL で作る(本番の初期設定と同じ手順。docs/reports/sprint-1.md) */
export function bootstrapProfile(userId: string, name: string, roles: string[]): void {
  const sql = `insert into public.profiles(user_id, organization_id, display_name) values ('${userId}', '${ORG_A}', '${name}');
    insert into public.user_roles(user_id, organization_id, role) select '${userId}', '${ORG_A}', r::public.app_role from unnest(array[${roles.map((r) => `'${r}'`).join(',')}]) r;`;
  execFileSync('psql', [env().db, '-v', 'ON_ERROR_STOP=1', '-qc', sql]);
}

export function sql(query: string): string {
  return execFileSync('psql', [env().db, '-v', 'ON_ERROR_STOP=1', '-Atqc', query], { encoding: 'utf8' }).trim();
}

export async function signIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** TOTP を登録して aal2 に上げる。2 回目以降は既存の要素で検証する */
export async function elevateToAal2(
  client: SupabaseClient,
  secretHolder: { secret?: string; factorId?: string },
): Promise<void> {
  if (!secretHolder.factorId) {
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `t-${randomUUID().slice(0, 6)}`,
    });
    if (error) throw error;
    secretHolder.secret = data.totp.secret;
    secretHolder.factorId = data.id;
  }
  const { data: ch, error: chErr } = await client.auth.mfa.challenge({ factorId: secretHolder.factorId });
  if (chErr) throw chErr;
  const { error } = await client.auth.mfa.verify({
    factorId: secretHolder.factorId,
    challengeId: ch.id,
    code: totp(secretHolder.secret!),
  });
  if (error) throw error;
}

export async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(fn, args);
  if (error) return { ok: false as const, error: `pg:${error.code}` };
  return data as { ok: true; data: unknown } | { ok: false; error: string };
}
