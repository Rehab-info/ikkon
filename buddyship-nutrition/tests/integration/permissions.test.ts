/**
 * 権限の結合テスト(TEST_PLAN §3):本物の JWT・MFA・PostgREST・Edge Function を通して確かめる
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anonClient, bootstrapProfile, createAuthUser, elevateToAal2, env, rpc, signIn, sql } from './helpers.ts';

type Actor = { id: string; email: string; client: SupabaseClient; mfa: { secret?: string; factorId?: string } };

let admin: Actor;
let staff: Actor;
let member: Actor;
let other: Actor;
let staffDoc: string;

async function actor(label: string): Promise<Omit<Actor, 'client'>> {
  const u = await createAuthUser(label);
  return { ...u, mfa: {} };
}

beforeAll(async () => {
  const a = await actor('admin');
  bootstrapProfile(a.id, '結合テスト管理者', ['admin']);
  admin = { ...a, client: await signIn(a.email) };
  await elevateToAal2(admin.client, admin.mfa);

  // 管理者 RPC でスタッフ・利用者を登録(Auth のユーザーは事前に作成)
  const s = await actor('staff');
  const m = await actor('member');
  const o = await actor('member2');
  for (const [u, name, role] of [
    [s, 'スタッフ', 'staff'],
    [m, '利用者', 'member'],
    [o, '利用者2', 'member'],
  ] as const) {
    const res = await rpc(admin.client, 'admin_register_profile', {
      p_user_id: u.id,
      p_display_name: name,
      p_role: role,
      p_facility_id: null,
    });
    expect(res).toEqual({ ok: true, data: { user_id: u.id } });
  }
  staff = { ...s, client: await signIn(s.email) };
  await elevateToAal2(staff.client, staff.mfa);
  member = { ...m, client: await signIn(m.email) };
  other = { ...o, client: await signIn(o.email) };
  staffDoc = sql(`select id from public.consent_documents where kind = 'staff_sharing'`);

  expect((await rpc(admin.client, 'admin_assign_staff', { p_staff_id: staff.id, p_member_id: member.id })).ok).toBe(
    true,
  );
});

describe('anonymous access', () => {
  it('cannot read tables or call RPCs', async () => {
    const anon = anonClient();
    const t = await anon.from('profiles').select('*');
    expect(t.error?.code).toBe('42501');
    expect(await rpc(anon, 'my_context')).toEqual({ ok: false, error: 'pg:42501' });
  });

  it('rejects a forged JWT', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: admin.id, role: 'authenticated', aal: 'aal2', exp: 9999999999 }),
    ).toString('base64url');
    const forged = `${header}.${payload}.${Buffer.from('not-the-signature').toString('base64url')}`;
    const res = await fetch(`${env().url}/rest/v1/rpc/my_context`, {
      method: 'POST',
      headers: { apikey: env().anon, Authorization: `Bearer ${forged}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });
});

describe('member isolation', () => {
  it('member sees only own profile and cannot write consents directly', async () => {
    const p = await member.client.from('profiles').select('user_id');
    expect(p.data).toEqual([{ user_id: member.id }]);
    const ins = await member.client.from('staff_access_consents').insert({
      member_id: member.id,
      staff_id: staff.id,
      scope: 'meals:read',
      document_id: staffDoc,
    });
    expect(ins.error?.code).toBe('42501');
    const role = await member.client
      .from('user_roles')
      .insert({ user_id: member.id, organization_id: '00000000-0000-4000-8000-000000000001', role: 'admin' });
    expect(role.error?.code).toBe('42501');
  });

  it('changing user metadata does not grant roles', async () => {
    await member.client.auth.updateUser({ data: { role: 'admin' } });
    await member.client.auth.refreshSession();
    expect(await rpc(member.client, 'admin_list_users')).toEqual({ ok: false, error: 'forbidden' });
  });
});

describe('consent lifecycle with real sessions', () => {
  it('member onboarding: pending documents can be accepted', async () => {
    const ctx = (await rpc(member.client, 'my_context')) as { ok: true; data: { pending_documents: { id: string }[] } };
    expect(ctx.data.pending_documents).toHaveLength(3);
    const res = await rpc(member.client, 'accept_documents', {
      p_document_ids: ctx.data.pending_documents.map((d) => d.id),
    });
    expect(res.ok).toBe(true);
  });

  it('staff sees the member without scopes until consent is granted', async () => {
    const before = await rpc(staff.client, 'staff_dashboard');
    // 同意がない列(食事・体の測定)は null = データを取得しない(Sprint 3 で列を追加)
    expect(before).toEqual({
      ok: true,
      data: [{ member_id: member.id, display_name: '利用者', scopes: [], meals: null, body: null }],
    });

    expect(
      (
        await rpc(member.client, 'grant_staff_consent', {
          p_staff_id: staff.id,
          p_scope: 'meals:read',
          p_document_id: staffDoc,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await rpc(member.client, 'grant_staff_consent', {
          p_staff_id: staff.id,
          p_scope: 'body:write',
          p_document_id: staffDoc,
        })
      ).ok,
    ).toBe(true);
    const after = (await rpc(staff.client, 'staff_dashboard')) as { ok: true; data: { scopes: string[] }[] };
    expect(after.data[0]!.scopes).toEqual(['meals:read', 'body:write']);
  });

  it('revocation applies to the very next request of the same staff session', async () => {
    expect((await rpc(member.client, 'revoke_staff_consent', { p_staff_id: staff.id, p_scope: 'meals:read' })).ok).toBe(
      true,
    );
    const after = (await rpc(staff.client, 'staff_dashboard')) as { ok: true; data: { scopes: string[] }[] };
    expect(after.data[0]!.scopes).toEqual(['body:write']);
  });

  it('other members cannot see or change this consent', async () => {
    const seen = await other.client.from('staff_access_consents').select('id').eq('member_id', member.id);
    expect(seen.data).toEqual([]);
    expect(
      await rpc(other.client, 'grant_staff_consent', {
        p_staff_id: staff.id,
        p_scope: 'meals:read',
        p_document_id: staffDoc,
      }),
    ).toEqual({ ok: false, error: 'forbidden' });
  });

  it('staff session without MFA (aal1) is denied', async () => {
    const aal1 = await signIn(staff.email);
    expect(await rpc(aal1, 'staff_dashboard')).toEqual({ ok: false, error: 'forbidden' });
  });

  it('admin cannot read consents and gets no health data', async () => {
    const c = await admin.client.from('staff_access_consents').select('id');
    expect(c.data).toEqual([]);
    const users = (await rpc(admin.client, 'admin_list_users')) as { ok: true; data: Record<string, unknown>[] };
    for (const u of users.data)
      expect(Object.keys(u).sort()).toEqual(['display_name', 'facility_id', 'roles', 'user_id']);
  });
});

describe('admin-invite-user edge function', () => {
  const call = (client: SupabaseClient | null, body: unknown, token?: string) =>
    (async () => {
      const session = client ? (await client.auth.getSession()).data.session : null;
      return fetch(`${env().functions}/admin-invite-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env().anon,
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : token
              ? { Authorization: `Bearer ${token}` }
              : {}),
        },
        body: JSON.stringify(body),
      });
    })();
  const body = (email: string) => ({
    email,
    display_name: '招待テスト',
    role: 'member',
    facility_id: '00000000-0000-4000-8000-000000000101',
  });

  it('admin (aal2) invites a member and the profile is registered', async () => {
    const email = `invite-${Date.now()}@example.test`;
    const res = await call(admin.client, body(email));
    expect(res.status).toBe(201);
    const { user_id } = (await res.json()) as { user_id: string };
    expect(sql(`select display_name || ':' || facility_id from public.profiles where user_id = '${user_id}'`)).toBe(
      '招待テスト:00000000-0000-4000-8000-000000000101',
    );
    expect(
      sql(
        `select string_agg(role::text, ',') from public.user_roles where user_id = '${user_id}' and revoked_at is null`,
      ),
    ).toBe('member');

    const dup = await call(admin.client, body(email));
    expect(dup.status).toBe(409);
  });

  it('non-admins cannot invite and no auth user is created', async () => {
    const email = `nope-${Date.now()}@example.test`;
    expect((await call(staff.client, body(email))).status).toBe(403);
    expect((await call(member.client, body(email))).status).toBe(403);
    expect((await call(await signIn(admin.email), body(email))).status).toBe(403); // admin without MFA
    expect(sql(`select count(*) from auth.users where email = '${email}'`)).toBe('0');
  });

  it('rejects unauthenticated and invalid requests', async () => {
    expect((await call(null, body('x@example.test'))).status).toBe(401);
    const bad = await call(admin.client, { ...body('x@example.test'), role: 'admin' });
    expect(bad.status).toBe(400);
    const json = (await bad.json()) as { error: { code: string } };
    expect(json.error.code).toBe('invalid_request');
    expect(JSON.stringify(json)).not.toMatch(/zod|stack|sql/i);
  });
});

describe('AI quota is atomic under concurrency', () => {
  it('10 parallel calls with a daily limit of 5 yield exactly 5 successes', async () => {
    expect((await rpc(admin.client, 'admin_set_setting', { p_key: 'ai_actor_minute_limit', p_value: 100 })).ok).toBe(
      true,
    );
    expect((await rpc(admin.client, 'admin_set_setting', { p_key: 'ai_member_day_limit', p_value: 5 })).ok).toBe(true);
    try {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => rpc(other.client, 'consume_ai_quota', { p_member_id: other.id })),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(5);
      expect(results.filter((r) => !r.ok && r.error === 'quota_exceeded')).toHaveLength(5);
      expect(
        sql(`select count from private.usage_counters where counter = 'ai_member_day' and subject_id = '${other.id}'`),
      ).toBe('5');
    } finally {
      await rpc(admin.client, 'admin_set_setting', { p_key: 'ai_actor_minute_limit', p_value: 3 });
      await rpc(admin.client, 'admin_set_setting', { p_key: 'ai_member_day_limit', p_value: 10 });
    }
  });
});
