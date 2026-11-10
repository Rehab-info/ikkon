/**
 * 食事画像の物理削除(Edge Function purge-expired-images + 削除キュー)の結合テスト(Sprint 3)
 *  - 30 日を過ぎた食事の画像と、食事に保存されなかった画像(24 時間経過)が Storage から消える
 *  - 新しい画像・期限内の画像は消えない
 *  - 呼び出しには秘密のヘッダが必要(利用者の JWT では実行できない)
 * 架空の利用者・最小の JPEG だけを使う
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bootstrapProfile, createAuthUser, env, signIn, sql } from './helpers.ts';

// supabase/.env.example のローカル専用の値(CI もこれを使う)
const SECRET = process.env['IT_PURGE_JOB_SECRET'] ?? 'local-only-purge-secret-0123456789abcdef';
const ORG = '00000000-0000-4000-8000-000000000001';
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

let member: { id: string; client: SupabaseClient };
const path = () => `${member.id}/2026/${randomUUID()}.jpg`;
const names: Record<'expired' | 'kept' | 'orphanOld' | 'orphanNew', string> = {
  expired: '',
  kept: '',
  orphanOld: '',
  orphanNew: '',
};

async function purge(headers: Record<string, string>, method = 'POST') {
  const res = await fetch(`${env().functions}/purge-expired-images`, {
    method,
    headers: { apikey: env().anon, Authorization: `Bearer ${env().anon}`, ...headers },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function exists(name: string): Promise<boolean> {
  const { data, error } = await member.client.storage.from('meal-images').download(name);
  return !error && !!data;
}

beforeAll(async () => {
  const u = await createAuthUser('m-purge');
  bootstrapProfile(u.id, 'm-purge', ['member']);
  member = { id: u.id, client: await signIn(u.email) };
  for (const k of Object.keys(names) as (keyof typeof names)[]) {
    names[k] = path();
    const up = await member.client.storage
      .from('meal-images')
      .upload(names[k], JPEG, { contentType: 'image/jpeg', upsert: false });
    expect(up.error).toBeNull();
  }
  // 写真付きの食事を 2 件(1 件は 30 日を過ぎた)。日付の操作は SQL で行う(テスト専用)
  const meal = (name: string, expires: string) =>
    sql(`insert into public.meals(member_id, organization_id, slot, eaten_on, eaten_at_precision, entry_source, entered_by,
           info_source, image_path, image_expires_at, total_energy_kcal, total_protein_g, total_fat_g, total_carbohydrate_g,
           nutrition_rules_version)
         values ('${member.id}', '${ORG}', 'dinner', current_date, 'slot_only', 'self', '${member.id}', 'photo',
           '${name}', ${expires}, 0, 0, 0, 0, 'sfct8-standard-v2') returning id`);
  meal(names.expired, `now() - interval '1 day'`);
  meal(names.kept, `now() + interval '29 days'`);
  sql(`update storage.objects set created_at = now() - interval '31 days'
        where bucket_id = 'meal-images' and name in ('${names.expired}', '${names.kept}')`);
  sql(`update storage.objects set created_at = now() - interval '25 hours'
        where bucket_id = 'meal-images' and name = '${names.orphanOld}'`);
});

describe('食事画像の定期削除', () => {
  it('rejects calls without the job secret (a user JWT is not enough)', async () => {
    expect((await purge({})).status).toBe(403);
    expect((await purge({ 'x-purge-secret': 'wrong' })).status).toBe(403);
    const token = (await member.client.auth.getSession()).data.session?.access_token ?? '';
    expect((await purge({ Authorization: `Bearer ${token}` })).status).toBe(403);
    expect((await purge({ 'x-purge-secret': SECRET }, 'GET')).status).toBe(400);
    expect(await exists(names.expired)).toBe(true);
  });

  it('removes expired and orphaned images from storage and clears the meal reference', async () => {
    const r = await purge({ 'x-purge-secret': SECRET });
    expect(r.status).toBe(200);
    expect((r.body['data'] as { done: number }).done).toBeGreaterThanOrEqual(2);
    expect(await exists(names.expired)).toBe(false);
    expect(await exists(names.orphanOld)).toBe(false);
    expect(await exists(names.kept)).toBe(true); // 期限内
    expect(await exists(names.orphanNew)).toBe(true); // 24 時間以内(保存の途中かもしれない)
    expect(sql(`select count(*) from public.meals where member_id = '${member.id}' and image_path is null`)).toBe('1');
    expect(
      sql(`select count(*) from audit.logs where action = 'meal_image.purge' and result = 'allowed'
             and subject_member_id = '${member.id}'`),
    ).toBe('2');
    // 監査ログに画像のパスは残さない
    expect(sql(`select count(*) from audit.logs where metadata::text like '%${member.id}/%'`)).toBe('0');
  });

  it('is idempotent: a second run does not touch the remaining images', async () => {
    const r = await purge({ 'x-purge-secret': SECRET });
    expect(r.status).toBe(200);
    expect(await exists(names.kept)).toBe(true);
    expect(await exists(names.orphanNew)).toBe(true);
    expect(
      sql(`select count(*) from audit.logs where action = 'meal_image.purge' and subject_member_id = '${member.id}'`),
    ).toBe('2');
  });
});
