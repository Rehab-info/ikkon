import {
  AdminAssignments,
  AdminUsers,
  AppError,
  MyContext,
  MyStaff,
  NullData,
  StaffDashboard,
  parseRpcResult,
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
  async adminInvite(input: InviteUserRequest): Promise<{ user_id: string }> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AppError('unauthenticated');
    const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/admin-invite-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(input),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const code = z.object({ error: z.object({ code: z.string() }) }).safeParse(json);
      throw new AppError(code.success && isErrorCode(code.data.error.code) ? code.data.error.code : 'internal');
    }
    return z.object({ user_id: z.uuid() }).parse(json);
  },
};
