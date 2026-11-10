import {
  AdminAssignments,
  AdminUsers,
  AppError,
  MyContext,
  MyStaff,
  NullData,
  StaffDashboard,
  AnalyzeResponse,
  DailySummary,
  FoodList,
  SavedMeal,
  SavedMeals,
  parseRpcResult,
  BodyHistory,
  BodyRecords,
  BodySaved,
  type BodyPayload,
  type MealSlot,
  type SaveMealPayload,
  type ConsentScope,
  type InviteUserRequest,
  isErrorCode,
} from '@buddyship/shared';
import { z } from 'zod';
import { supabase } from './supabase.ts';
import { env } from './env.ts';

async function call<T extends z.ZodType>(
  fn: string,
  schema: T,
  args: Record<string, unknown> = {},
): Promise<z.output<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new AppError(error.code === 'PGRST301' || error.code === '42501' ? 'unauthenticated' : 'internal');
  return parseRpcResult(schema, data);
}

export const api = {
  myContext: () => call('my_context', MyContext),
  acceptDocuments: (ids: string[]) => call('accept_documents', NullData, { p_document_ids: ids }),
  listMyStaff: () => call('list_my_staff', MyStaff),
  grantConsent: (staffId: string, scope: ConsentScope, documentId: string) =>
    call('grant_staff_consent', NullData, { p_staff_id: staffId, p_scope: scope, p_document_id: documentId }),
  revokeConsent: (staffId: string, scope: ConsentScope) =>
    call('revoke_staff_consent', NullData, { p_staff_id: staffId, p_scope: scope }),
  staffDashboard: () => call('staff_dashboard', StaffDashboard),
  adminListUsers: () => call('admin_list_users', AdminUsers),
  adminListAssignments: () => call('admin_list_assignments', AdminAssignments),
  adminAssign: (staffId: string, memberId: string) =>
    call('admin_assign_staff', z.object({ assignment_id: z.uuid() }), { p_staff_id: staffId, p_member_id: memberId }),
  adminEndAssignment: (assignmentId: string) =>
    call('admin_end_assignment', NullData, { p_assignment_id: assignmentId }),
  adminSetRole: (userId: string, role: 'member' | 'staff', active: boolean) =>
    call('admin_set_role', NullData, { p_user_id: userId, p_role: role, p_active: active }),

  /** スタッフ共有の同意文書(最新版) */
  async staffSharingDocument(): Promise<{ id: string; title: string; body: string }> {
    const { data, error } = await supabase
      .from('consent_documents')
      .select('id, title, body')
      .eq('kind', 'staff_sharing')
      .order('published_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) throw new AppError('internal');
    return z.object({ id: z.uuid(), title: z.string(), body: z.string() }).parse(data);
  },

  async updateMyProfile(patch: { display_name?: string; font_scale?: 0 | 1 | 2 }, userId: string): Promise<void> {
    const { error } = await supabase.from('profiles').update(patch).eq('user_id', userId);
    if (error) throw new AppError('internal');
  },

  /** 管理者による招待(Edge Function admin-invite-user) */
  adminInvite: (input: InviteUserRequest) =>
    callFunction('admin-invite-user', z.object({ user_id: z.uuid() }), { method: 'POST', body: input }),

  // ---- 食事記録(Sprint 2) ----
  searchFoods: (q: string) => call('search_foods', FoodList, { p_query: q, p_limit: 20 }),
  getMeals: (memberId: string, from: string, to: string) =>
    call('get_meals', SavedMeals, { p_member_id: memberId, p_from: from, p_to: to }),
  getMeal: (mealId: string) => call('get_meal', SavedMeal, { p_meal_id: mealId }),
  getDailySummary: (memberId: string, from: string, to: string) =>
    call('get_daily_summary', DailySummary, { p_member_id: memberId, p_from: from, p_to: to }),
  saveMeal: (memberId: string, payload: SaveMealPayload) =>
    call('save_meal', z.object({ meal_id: z.uuid() }), { p_member_id: memberId, p_payload: payload }),
  updateMeal: (mealId: string, payload: SaveMealPayload) =>
    call('update_meal', z.object({ meal_id: z.uuid() }), { p_meal_id: mealId, p_payload: payload }),
  /** 食事を消す(本人だけ)。写真があれば Storage からも消す(本人のフォルダは本人が消せる) */
  async deleteMeal(mealId: string): Promise<void> {
    const { image_path } = await call('delete_meal', z.object({ image_path: z.string().nullable() }), {
      p_meal_id: mealId,
    });
    if (image_path) {
      const { error } = await supabase.storage.from('meal-images').remove([image_path]);
      if (error) throw new AppError('internal');
    }
  },
  setSlotStatus: (memberId: string, date: string, slot: MealSlot, status: 'skipped' | 'dayservice' | null) =>
    call('set_slot_status', NullData, { p_member_id: memberId, p_eaten_on: date, p_slot: slot, p_status: status }),

  // ---- 体組成(InBody。Sprint 3) ----
  getBodyRecords: (memberId: string, from: string, to: string) =>
    call('get_body_compositions', BodyRecords, { p_member_id: memberId, p_from: from, p_to: to }),
  getBodyHistory: (id: string) => call('get_body_composition_history', BodyHistory, { p_id: id }),
  saveBody: (memberId: string, payload: BodyPayload) =>
    call('save_body_composition', BodySaved, { p_member_id: memberId, p_payload: payload }),
  updateBody: (id: string, payload: BodyPayload) =>
    call('update_body_composition', BodySaved, { p_id: id, p_payload: payload }),
  deleteBody: (id: string) => call('delete_body_composition', NullData, { p_id: id }),

  /** 食事の写真をアップロード(本人のフォルダ。代理のときは利用者のフォルダ。Storage のポリシーで制御) */
  async uploadMealImage(memberId: string, blob: Blob): Promise<string> {
    const path = `${memberId}/${new Date().getFullYear()}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from('meal-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new AppError('forbidden');
    return path;
  },
  analyzeMeal: (memberId: string, imagePath: string) =>
    callFunction('analyze-meal', AnalyzeResponse, {
      method: 'POST',
      body: { member_id: memberId, image_path: imagePath },
    }),
  /** 食事の写真(本人だけ)。端末に保存しないよう、表示用の一時 URL にする */
  async mealImageUrl(mealId: string): Promise<string> {
    const res = await functionFetch(`meal-image?meal_id=${encodeURIComponent(mealId)}`, { method: 'GET' });
    if (!res.ok) throw new AppError(await errorCodeOf(res));
    return URL.createObjectURL(await res.blob());
  },
};

async function functionFetch(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AppError('unauthenticated');
  return fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.VITE_SUPABASE_ANON_KEY,
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function errorCodeOf(res: Response) {
  const json: unknown = await res.json().catch(() => null);
  const code = z.object({ error: z.object({ code: z.string() }) }).safeParse(json);
  return code.success && isErrorCode(code.data.error.code) ? code.data.error.code : 'internal';
}

/** Edge Function の呼び出し(エラーは AppError に。応答は Zod で検証) */
async function callFunction<T extends z.ZodType>(
  name: string,
  schema: T,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<z.output<T>> {
  const res = await functionFetch(name, init);
  if (!res.ok) throw new AppError(await errorCodeOf(res));
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new AppError('internal');
  return parsed.data;
}
