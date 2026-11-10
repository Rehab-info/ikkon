/**
 * 食事記録の結合テスト(Sprint 2):本物の JWT・MFA・Storage・Edge Function・RPC を通す
 *  - 写真のアップロード → 解析(mock)→ 照合(確定/要確認)→ 保存 → 再表示
 *  - 保存した栄養値が packages/nutrition の計算と一致すること(要確認は小計)
 *  - 本人・担当スタッフ(閲覧/代理入力/同意なし)の権限、同意撤回後の遮断、画像のアクセス制御
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  displayValue,
  itemNutrients,
  consumedHundredthsG,
  mealTotalHeading,
  summarizeMeal,
  type MealLine,
  type Per100g,
} from '../../packages/nutrition/src/index.ts';
import {
  AnalyzeResponse as AnalyzeResponseSchema,
  SavedMeal as SavedMealSchema,
} from '../../packages/shared/src/meals.ts';
import { bootstrapProfile, createAuthUser, elevateToAal2, env, rpc, signIn, sql } from './helpers.ts';

type AnalyzeResponse = typeof AnalyzeResponseSchema._output;
type FoodItem = Extract<AnalyzeResponse['items'][number], { kind: 'food' }>;
type DishItem = Extract<AnalyzeResponse['items'][number], { kind: 'dish' }>;
type AnalyzedLine = FoodItem | DishItem['components'][number];
type SavedMeal = typeof SavedMealSchema._output;
type SavedItem = SavedMeal['items'][number];

type Actor = { id: string; email: string; client: SupabaseClient };
let member: Actor;
let other: Actor;
let staffWrite: Actor;
let staffRead: Actor;
let staffNone: Actor;

const ORG = '00000000-0000-4000-8000-000000000001';
/** SOI + SOF0(640×480)だけの最小 JPEG。サーバーの検査(中身の判定・大きさ)を通る */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function makeUser(label: string, roles: string[], aal2 = false): Promise<Actor> {
  const u = await createAuthUser(label);
  bootstrapProfile(u.id, label, roles);
  const client = await signIn(u.email);
  if (aal2) await elevateToAal2(client, {});
  return { ...u, client };
}

const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const imagePath = (memberId: string) => `${memberId}/2026/${randomUUID()}.jpg`;

async function upload(client: SupabaseClient, path: string, bytes = JPEG) {
  return client.storage.from('meal-images').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
}

/** 解析を呼ぶ。成功時は共有スキーマで応答の形も確かめる */
async function analyze(client: SupabaseClient, memberId: string, path: string) {
  const token = (await client.auth.getSession()).data.session?.access_token;
  const res = await fetch(`${env().functions}/analyze-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env().anon, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ member_id: memberId, image_path: path }),
  });
  const json: unknown = await res.json();
  return { status: res.status, body: res.ok ? AnalyzeResponseSchema.parse(json) : null };
}

async function getMeal(client: SupabaseClient, mealId: string): Promise<SavedMeal> {
  const r = (await rpc(client, 'get_meal', { p_meal_id: mealId })) as { ok: boolean; data?: unknown };
  expect(r.ok).toBe(true);
  return SavedMealSchema.parse(r.data);
}

function linesOf(a: AnalyzeResponse): AnalyzedLine[] {
  const out: AnalyzedLine[] = [];
  for (const it of a.items) {
    if (it.kind === 'food') out.push(it);
    else out.push(...it.components);
  }
  return out;
}

/**
 * 解析結果 → save_meal の明細(AI の推定値のまま、全部食べた)。
 * AI の候補は自動確定されないので、利用者が「これで合っている」を押した操作を
 * confirmSuggested で再現する(押さなければ全部が要確認のまま)。
 */
function toPayloadItems(a: AnalyzeResponse, confirmSuggested = true) {
  const mk = (l: AnalyzedLine, role: string, dish?: { id: string; label: string; known: boolean }) => {
    const chosen = confirmSuggested ? l.suggested : null;
    return {
      role,
      dish_group_id: dish?.id ?? null,
      dish_label: dish?.label ?? null,
      dish_composition_known: dish ? dish.known : null,
      match_status: chosen ? ('confirmed' as const) : ('needs_review' as const),
      food_id: chosen ? chosen.food_id : null,
      candidate_food_ids: chosen ? [] : l.candidates.map((c) => c.food_id),
      origin: 'ai',
      ai_label: l.ai_label,
      ai_estimated_served_g: l.ai_estimated_served_g,
      served_g: l.ai_estimated_served_g,
      intake_percent: 100,
      label: chosen ? chosen.display_name : l.ai_label,
    };
  };
  const out: ReturnType<typeof mk>[] = [];
  for (const it of a.items) {
    if (it.kind === 'food') {
      out.push(mk(it, 'food'));
    } else {
      const dish = { id: randomUUID(), label: it.dish_label, known: it.composition_known };
      for (const c of it.components) out.push(mk(c, c.role, dish));
    }
  }
  return out;
}

const payload = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  slot: 'dinner',
  location: 'home',
  eaten_on: today(),
  eaten_at: null,
  eaten_at_precision: 'slot_only',
  info_source: 'photo',
  analysis_id: null,
  image_path: null,
  items,
  ...extra,
});

const NUTRIENTS = ['energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g'] as const;
const toPer100 = (p: NonNullable<SavedItem['per100']>): Per100g =>
  Object.fromEntries(
    NUTRIENTS.map((n) => [n, { ...p[n], traceAsZero: p[n].kind === 'trace' || p[n].kind === 'estimated_trace' }]),
  ) as Per100g;

/** 保存された明細を packages/nutrition で計算し直し、DB の値と比べる */
function verifyAgainstModule(meal: SavedMeal) {
  const lines: MealLine[] = meal.items.map((i) => {
    const consumed = consumedHundredthsG(Number(i.served_g), i.intake_percent);
    expect(Math.round(Number(i.consumed_g) * 100)).toBe(consumed);
    const nutrients = i.match_status === 'confirmed' && i.per100 ? itemNutrients(toPer100(i.per100), consumed) : null;
    if (nutrients) {
      for (const n of NUTRIENTS) {
        const db = i.amounts[n];
        expect(db === null ? null : Math.round(Number(db) * 100), `${n}`).toBe(nutrients[n].hundredths);
      }
    }
    return {
      role: i.role as MealLine['role'],
      matchStatus: i.match_status,
      nutrients,
      ...(i.dish_group_id
        ? { dish: { groupId: i.dish_group_id, label: 'd', compositionKnown: i.dish_composition_known ?? true } }
        : {}),
    };
  });
  const summary = summarizeMeal(lines);
  for (const n of NUTRIENTS)
    expect(Math.round(Number(meal.totals[n]) * 100), `total ${n}`).toBe(summary.totals[n].hundredths);
  expect(meal.needs_review_count).toBe(summary.needsReviewCount);
  return summary;
}

beforeAll(async () => {
  member = await makeUser('m-meal', ['member']);
  other = await makeUser('m-other', ['member']);
  staffWrite = await makeUser('s-write', ['staff'], true);
  staffRead = await makeUser('s-read', ['staff'], true);
  staffNone = await makeUser('s-none', ['staff'], true);
  const doc = sql(`select id from public.consent_documents where kind = 'staff_sharing'`);
  sql(`insert into public.staff_assignments(organization_id, staff_id, member_id) values
       ('${ORG}', '${staffWrite.id}', '${member.id}'), ('${ORG}', '${staffRead.id}', '${member.id}'), ('${ORG}', '${staffNone.id}', '${member.id}')`);
  for (const [staff, scope] of [
    [staffWrite, 'meals:write'],
    [staffRead, 'meals:read'],
  ] as const) {
    const r = await rpc(member.client, 'grant_staff_consent', {
      p_staff_id: staff.id,
      p_scope: scope,
      p_document_id: doc,
    });
    expect(r.ok).toBe(true);
  }
  sql(
    `update private.settings set value = '100' where key in ('ai_actor_minute_limit','ai_member_day_limit','ai_staff_day_limit')`,
  );
  sql(`update private.settings set value = '100000' where key = 'ai_org_month_limit'`);
});

describe('写真 → 解析 → 照合 → 保存 → 再表示', () => {
  let analysis: AnalyzeResponse;
  let path: string;
  let mealId: string;

  it('member uploads a photo into their own folder', async () => {
    path = imagePath(member.id);
    const up = await upload(member.client, path);
    expect(up.error).toBeNull();
    const bad = await upload(member.client, imagePath(other.id));
    expect(bad.error).not.toBeNull();
  });

  it('analysis returns dishes with ingredients; nothing is auto-confirmed, exact unique matches are only suggested', async () => {
    const r = await analyze(member.client, member.id, path);
    expect(r.status).toBe(200);
    if (!r.body) throw new Error('no body');
    analysis = r.body;
    expect(analysis.provider).toBe('mock');
    const all = linesOf(analysis);
    // Sprint 3:AI が生成した食品候補は自動的に確定しない
    expect(all.every((l) => l.match_status === 'needs_review')).toBe(true);
    expect(JSON.stringify(analysis)).not.toContain('"confirmed"');
    const strength = Object.fromEntries(all.map((l) => [l.ai_label, l.suggestion_strength]));
    expect(strength['ごはん']).toBe('suggested');
    expect(strength['じゃがいも']).toBe('suggested');
    expect(strength['豚肉']).toBe('ambiguous'); // 候補が 2 つ
    expect(strength['豆腐']).toBe('ambiguous');
    expect(strength['サラダ油']).toBe('ambiguous'); // AI の確からしさが低い
    for (const l of all) if (l.suggestion_strength !== 'suggested') expect(l.suggested).toBeNull();
    expect(
      all
        .find((l) => l.ai_label === '豚肉')!
        .candidates.map((c) => c.food_code)
        .sort(),
    ).toEqual(['11123', '11129']);
    expect(JSON.stringify(analysis)).not.toMatch(/energy_kcal"\s*:\s*\d+[^}]*"ai_label/); // AI の栄養値は返さない
  });

  it('saving with needs-review items stores a confirmed-only subtotal that equals the module calculation', async () => {
    const r = await rpc(member.client, 'save_meal', {
      p_member_id: member.id,
      p_payload: payload(toPayloadItems(analysis), { analysis_id: analysis.analysis_id, image_path: path }),
    });
    expect(r).toMatchObject({ ok: true });
    mealId = (r as { data: { meal_id: string } }).data.meal_id;
    const got = await getMeal(member.client, mealId);
    const summary = verifyAgainstModule(got);
    expect(summary.scope).toBe('confirmed_only_subtotal');
    expect(mealTotalHeading(summary).heading).toBe('確認済み食品のみの小計');
    expect(mealTotalHeading(summary).notes[0]).toContain('未確認の食品は含まれていません');
    expect(got.image_path).toBe(path);
  });

  it('resolving needs-review items and changing grams/intake gives an all-confirmed estimate that still matches', async () => {
    const got = await getMeal(member.client, mealId);
    const items = got.items.map((i) => ({
      role: i.role,
      dish_group_id: i.dish_group_id,
      dish_label: i.dish_label,
      dish_composition_known: i.dish_composition_known,
      match_status: 'confirmed',
      food_id: i.food_id ?? i.candidates[0]?.food_id,
      candidate_food_ids: [],
      origin: 'ai_corrected',
      ai_label: i.ai_label,
      ai_estimated_served_g: i.ai_estimated_served_g,
      served_g: Math.round(Number(i.served_g) * 1.1 * 10) / 10,
      intake_percent: 80,
      label: i.label,
    }));
    const upd = await rpc(member.client, 'update_meal', {
      p_meal_id: mealId,
      p_payload: payload(items, { analysis_id: analysis.analysis_id, image_path: path }),
    });
    expect(upd).toMatchObject({ ok: true });
    const again = await getMeal(member.client, mealId);
    const summary = verifyAgainstModule(again);
    expect(summary.scope).toBe('all_confirmed');
    expect(mealTotalHeading(summary).heading).toBe('推定摂取量');
    // みそ汁は構成不明 → おおよその表示
    expect(summary.precision).toBe('approximate');
    expect(displayValue('energy_kcal', summary.totals.energy_kcal.hundredths, summary.precision)).toMatch(/^約\d+0$/);
    // 保存 → 再表示で同じ値(2 回読んでも同じ)
    const third = await getMeal(member.client, mealId);
    expect(third.totals).toEqual(again.totals);
  });

  it('member can view the meal image; staff and others cannot (and the image is not cached)', async () => {
    const get = async (c: SupabaseClient) => {
      const token = (await c.auth.getSession()).data.session?.access_token;
      return fetch(`${env().functions}/meal-image?meal_id=${mealId}`, {
        headers: { apikey: env().anon, Authorization: `Bearer ${token}` },
      });
    };
    const ok = await get(member.client);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/jpeg');
    expect(ok.headers.get('cache-control')).toContain('no-store');
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(JPEG);
    expect((await get(staffRead.client)).status).toBe(403);
    expect((await get(staffWrite.client)).status).toBe(403);
    expect((await get(other.client)).status).toBe(403);
    expect(
      sql(
        `select count(*) from audit.logs where action = 'meal.image.view' and actor_id = '${member.id}' and result = 'allowed'`,
      ),
    ).toBe('1');
    expect(
      Number(
        sql(
          `select count(*) from audit.logs where action = 'meal.image.view' and result = 'denied' and subject_member_id = '${member.id}'`,
        ),
      ),
    ).toBeGreaterThanOrEqual(3);
    // Storage を直接読んでも、他人・閲覧スタッフには見えない
    expect((await staffRead.client.storage.from('meal-images').download(path)).error).not.toBeNull();
    expect((await other.client.storage.from('meal-images').download(path)).error).not.toBeNull();
  });
});

describe('Storage と解析の入力検証', () => {
  it('only the member can delete images in their folder (used when a meal is deleted)', async () => {
    const p = imagePath(member.id);
    expect((await upload(member.client, p)).error).toBeNull();
    await staffWrite.client.storage.from('meal-images').remove([p]);
    expect((await member.client.storage.from('meal-images').download(p)).error).toBeNull(); // staff could not delete
    const { data, error } = await member.client.storage.from('meal-images').remove([p]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect((await member.client.storage.from('meal-images').download(p)).error).not.toBeNull();
  });

  it('a PNG disguised as JPEG is rejected by content and recorded as rejected', async () => {
    const p = imagePath(member.id);
    expect((await upload(member.client, p, PNG)).error).toBeNull();
    const r = await analyze(member.client, member.id, p);
    expect(r.status).toBe(415);
    expect(sql(`select status from public.meal_analyses where image_path = '${p}'`)).toBe('rejected');
  });

  it('analysis of another member path / unauthenticated is rejected', async () => {
    const r = await analyze(member.client, other.id, imagePath(other.id));
    expect(r.status).toBe(403);
    const res = await fetch(`${env().functions}/analyze-meal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env().anon },
      body: JSON.stringify({ member_id: member.id, image_path: imagePath(member.id) }),
    });
    expect(res.status).toBe(401);
  });
});

describe('担当スタッフ:代理入力・閲覧・同意撤回', () => {
  it('staff with meals:write uploads and analyses a proxy photo, then saves a proxy meal', async () => {
    const p = imagePath(member.id);
    expect((await upload(staffWrite.client, p)).error).toBeNull();
    const r = await analyze(staffWrite.client, member.id, p);
    expect(r.status).toBe(200);
    if (!r.body) throw new Error('no body');
    const items = toPayloadItems(r.body)
      .filter((i) => i.match_status === 'confirmed')
      .slice(0, 2);
    const s = await rpc(staffWrite.client, 'save_meal', {
      p_member_id: member.id,
      p_payload: payload(items, { slot: 'lunch', analysis_id: r.body.analysis_id, image_path: p }),
    });
    expect(s).toMatchObject({ ok: true });
    const meals = (await rpc(member.client, 'get_meals', {
      p_member_id: member.id,
      p_from: today(),
      p_to: today(),
    })) as { ok: true; data: { entry_source: string; slot: string }[] };
    expect(meals.data.find((m) => m.slot === 'lunch')!.entry_source).toBe('staff');
  });

  it('staff with only meals:read can read but cannot upload, analyse or save', async () => {
    const list = await rpc(staffRead.client, 'get_meals', { p_member_id: member.id, p_from: today(), p_to: today() });
    expect(list.ok).toBe(true);
    expect((await upload(staffRead.client, imagePath(member.id))).error).not.toBeNull();
    expect((await analyze(staffRead.client, member.id, imagePath(member.id))).status).toBe(403);
    expect(await rpc(staffRead.client, 'save_meal', { p_member_id: member.id, p_payload: payload([]) })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('assigned staff without consent gets nothing', async () => {
    expect(
      await rpc(staffNone.client, 'get_meals', { p_member_id: member.id, p_from: today(), p_to: today() }),
    ).toEqual({ ok: false, error: 'forbidden' });
    expect((await analyze(staffNone.client, member.id, imagePath(member.id))).status).toBe(403);
  });

  it('after the member revokes, the same staff sessions are denied on the next request', async () => {
    expect(
      (await rpc(member.client, 'revoke_staff_consent', { p_staff_id: staffWrite.id, p_scope: 'meals:write' })).ok,
    ).toBe(true);
    expect(
      (await rpc(member.client, 'revoke_staff_consent', { p_staff_id: staffRead.id, p_scope: 'meals:read' })).ok,
    ).toBe(true);
    expect(
      await rpc(staffRead.client, 'get_meals', { p_member_id: member.id, p_from: today(), p_to: today() }),
    ).toEqual({ ok: false, error: 'forbidden' });
    expect(await rpc(staffWrite.client, 'save_meal', { p_member_id: member.id, p_payload: payload([]) })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect((await analyze(staffWrite.client, member.id, imagePath(member.id))).status).toBe(403);
    expect((await upload(staffWrite.client, imagePath(member.id))).error).not.toBeNull();
  });
});

describe('計算の一致(無作為の 300 件:SQL と packages/nutrition)', () => {
  it('saved amounts equal the module for random foods, grams and intake', async () => {
    // 再現できる擬似乱数
    let seed = 20261110;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const ids = sql(`select string_agg(id::text, ',' order by source_food_code) from public.foods`).split(',');
    // Tr・推定・未測定を含む食品を必ず混ぜる
    const special = sql(
      `select string_agg(id::text, ',') from public.foods where source_food_code in ('09059','02061','15015','01176','11183')`,
    ).split(',');
    for (let batch = 0; batch < 10; batch++) {
      const items = Array.from({ length: 30 }, (_, k) => ({
        role: 'food',
        match_status: 'confirmed',
        food_id: k < special.length && batch === 0 ? special[k] : ids[Math.floor(rnd() * ids.length)],
        candidate_food_ids: [],
        origin: 'manual',
        served_g: Math.max(0.1, Math.round(rnd() * 20000) / 10),
        intake_percent: Math.floor(rnd() * 101),
      }));
      const r = await rpc(member.client, 'save_meal', {
        p_member_id: member.id,
        p_payload: payload(items, { slot: 'snack', info_source: 'manual' }),
      });
      expect(r).toMatchObject({ ok: true });
      verifyAgainstModule(await getMeal(member.client, (r as { data: { meal_id: string } }).data.meal_id));
    }
  });
});
