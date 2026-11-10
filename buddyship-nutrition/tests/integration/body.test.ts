/**
 * InBody(体組成)の結合テスト(Sprint 3)。実際のログイン・MFA(aal2)・同意の付与と撤回を通す
 *  - 本人の記録と、body:write の担当スタッフの代理入力
 *  - 担当外のスタッフ・同意のないスタッフ・撤回後のスタッフは拒否
 *  - スタッフのダッシュボード:同意のない列は null(同意なし)、記録がなければ null(未記録)
 * 架空の利用者・架空の測定値だけを使う
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BodyHistory, BodyRecords, BodySaved, StaffDashboard } from '@buddyship/shared';
import { bootstrapProfile, createAuthUser, elevateToAal2, rpc, signIn, sql } from './helpers.ts';

type Actor = { id: string; email: string; client: SupabaseClient };
const ORG = '00000000-0000-4000-8000-000000000001';
let member: Actor;
let staffWrite: Actor;
let staffRead: Actor;
let staffOther: Actor;

async function makeUser(label: string, roles: string[], aal2 = false): Promise<Actor> {
  const u = await createAuthUser(label);
  bootstrapProfile(u.id, label, roles);
  const client = await signIn(u.email);
  if (aal2) await elevateToAal2(client, {});
  return { ...u, client };
}

const body = (over: Record<string, unknown> = {}) => ({
  measured_at: new Date(Date.now() - 3600_000).toISOString(),
  weight_kg: 52.4,
  skeletal_muscle_kg: 19.8,
  body_fat_kg: 16.1,
  body_fat_pct: 30.7,
  device_model: 'InBody(架空の機種)',
  condition: 'before_meal',
  ...over,
});
const range = () => {
  const d = new Date(Date.now() + 9 * 3600_000);
  const to = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() - 30);
  return { p_from: d.toISOString().slice(0, 10), p_to: to };
};

beforeAll(async () => {
  member = await makeUser('m-body', ['member']);
  staffWrite = await makeUser('s-body-write', ['staff'], true);
  staffRead = await makeUser('s-body-read', ['staff'], true);
  staffOther = await makeUser('s-body-other', ['staff'], true);
  sql(`insert into public.staff_assignments(organization_id, staff_id, member_id) values
       ('${ORG}', '${staffWrite.id}', '${member.id}'), ('${ORG}', '${staffRead.id}', '${member.id}')`);
  const doc = sql(`select id from public.consent_documents where kind = 'staff_sharing'`);
  for (const [staff, scope] of [
    [staffWrite, 'body:write'],
    [staffRead, 'body:read'],
    [staffRead, 'meals:read'],
  ] as const) {
    const r = await rpc(member.client, 'grant_staff_consent', {
      p_staff_id: staff.id,
      p_scope: scope,
      p_document_id: doc,
    });
    expect(r.ok).toBe(true);
  }
});

describe('InBody:本人と担当スタッフ', () => {
  it('dashboard shows 未記録 (null date) before any measurement', async () => {
    const r = await rpc(staffRead.client, 'staff_dashboard');
    expect(r.ok).toBe(true);
    const row = StaffDashboard.parse((r as { data: unknown }).data).find((m) => m.member_id === member.id)!;
    expect(row.body).toEqual({ last_measured_at: null });
    expect(row.meals?.last_meal_on).toBeNull();
    expect(row.meals?.last_7_days).toHaveLength(7);
  });

  it('member saves, staff with body:write saves a proxy record, both appear for body:read staff', async () => {
    const own = await rpc(member.client, 'save_body_composition', { p_member_id: member.id, p_payload: body() });
    expect(own.ok).toBe(true);
    expect(BodySaved.parse((own as { data: unknown }).data).warnings).toEqual([]);
    const proxy = await rpc(staffWrite.client, 'save_body_composition', {
      p_member_id: member.id,
      p_payload: body({ weight_kg: 52.0, body_fat_pct: 35.0 }),
    });
    expect(proxy.ok).toBe(true);
    expect(BodySaved.parse((proxy as { data: unknown }).data).warnings).toEqual(['fat_pct_mismatch']);

    const list = await rpc(staffRead.client, 'get_body_compositions', { p_member_id: member.id, ...range() });
    const rows = BodyRecords.parse((list as { data: unknown }).data);
    expect(rows.map((r) => r.entry_source).sort()).toEqual(['self', 'staff']);
    expect(rows.find((r) => r.entry_source === 'staff')!.entered_by_name).toBe('s-body-write');

    const mine = await rpc(staffWrite.client, 'get_body_compositions', { p_member_id: member.id, ...range() });
    expect(BodyRecords.parse((mine as { data: unknown }).data)).toHaveLength(1); // body:write だけ = 自分の入力だけ
  });

  it('edits keep a history; staff without body:read cannot see it', async () => {
    const list = await rpc(member.client, 'get_body_compositions', { p_member_id: member.id, ...range() });
    const own = BodyRecords.parse((list as { data: unknown }).data).find((r) => r.entry_source === 'self')!;
    const upd = await rpc(member.client, 'update_body_composition', {
      p_id: own.id,
      p_payload: body({ weight_kg: 52.6 }),
    });
    expect(upd.ok).toBe(true);
    const h = await rpc(member.client, 'get_body_composition_history', { p_id: own.id });
    const hist = BodyHistory.parse((h as { data: unknown }).data);
    expect(hist.map((x) => [x.op, x.snapshot.weight_kg])).toEqual([
      ['insert', 52.4],
      ['update', 52.6],
    ]);
    expect(await rpc(staffWrite.client, 'get_body_composition_history', { p_id: own.id })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('unassigned staff and staff without consent are denied', async () => {
    expect(await rpc(staffOther.client, 'get_body_compositions', { p_member_id: member.id, ...range() })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(await rpc(staffRead.client, 'save_body_composition', { p_member_id: member.id, p_payload: body() })).toEqual(
      {
        ok: false,
        error: 'forbidden',
      },
    );
  });

  it('dashboard shows the latest measurement date only (no values)', async () => {
    const r = await rpc(staffRead.client, 'staff_dashboard');
    const row = StaffDashboard.parse((r as { data: unknown }).data).find((m) => m.member_id === member.id)!;
    expect(row.body?.last_measured_at).not.toBeNull();
    expect(JSON.stringify(row)).not.toMatch(/52\.|weight/);
    // body:write だけのスタッフ:体の列は「同意なし」、食事の列も「同意なし」
    const w = await rpc(staffWrite.client, 'staff_dashboard');
    const wrow = StaffDashboard.parse((w as { data: unknown }).data).find((m) => m.member_id === member.id)!;
    expect(wrow.body).toBeNull();
    expect(wrow.meals).toBeNull();
  });

  it('after revoke, the staff is denied immediately and the dashboard column becomes 同意なし', async () => {
    expect(
      (await rpc(member.client, 'revoke_staff_consent', { p_staff_id: staffRead.id, p_scope: 'body:read' })).ok,
    ).toBe(true);
    expect(await rpc(staffRead.client, 'get_body_compositions', { p_member_id: member.id, ...range() })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    const r = await rpc(staffRead.client, 'staff_dashboard');
    const row = StaffDashboard.parse((r as { data: unknown }).data).find((m) => m.member_id === member.id)!;
    expect(row.body).toBeNull();
    expect(row.meals).not.toBeNull(); // 食事の同意は残っている
    expect(
      (await rpc(member.client, 'revoke_staff_consent', { p_staff_id: staffWrite.id, p_scope: 'body:write' })).ok,
    ).toBe(true);
    expect(
      await rpc(staffWrite.client, 'save_body_composition', { p_member_id: member.id, p_payload: body() }),
    ).toEqual({ ok: false, error: 'forbidden' });
  });

  it('only the member can delete; deleted values stay in the member-only history', async () => {
    const list = await rpc(member.client, 'get_body_compositions', { p_member_id: member.id, ...range() });
    const rows = BodyRecords.parse((list as { data: unknown }).data);
    for (const r of rows) expect((await rpc(member.client, 'delete_body_composition', { p_id: r.id })).ok).toBe(true);
    const h = await rpc(member.client, 'get_body_composition_history', { p_id: rows[0]!.id });
    expect(BodyHistory.parse((h as { data: unknown }).data).at(-1)!.op).toBe('delete');
    expect(
      sql(
        `select count(*) from audit.logs where action = 'body_compositions.delete' and subject_member_id = '${member.id}'`,
      ),
    ).toBe(String(rows.length));
  });
});
