import { z } from 'zod';

export const AppRole = z.enum(['member', 'staff', 'admin']);
export type AppRole = z.infer<typeof AppRole>;

export const ConsentScope = z.enum(['meals:read', 'meals:write', 'body:read', 'body:write']);
export type ConsentScope = z.infer<typeof ConsentScope>;

export const DocumentKind = z.enum(['terms', 'privacy', 'ai_processing', 'staff_sharing']);

export const DisplayName = z.string().trim().min(1, '名前を入れてください').max(50, '50 文字以内にしてください');

export const FontScale = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type FontScale = z.infer<typeof FontScale>;

export const PendingDocument = z.object({
  id: z.uuid(),
  kind: DocumentKind,
  version: z.string(),
  title: z.string(),
  body: z.string(),
});

export const MyContext = z.discriminatedUnion('registered', [
  z.object({ registered: z.literal(false) }),
  z.object({
    registered: z.literal(true),
    user_id: z.uuid(),
    display_name: z.string(),
    font_scale: FontScale,
    organization_id: z.uuid(),
    facility_id: z.uuid().nullable(),
    roles: z.array(AppRole),
    aal: z.enum(['aal1', 'aal2']),
    pending_documents: z.array(PendingDocument),
  }),
]);
export type MyContext = z.infer<typeof MyContext>;

export const MyStaff = z.array(
  z.object({
    staff_id: z.uuid(),
    display_name: z.string(),
    assigned_at: z.string(),
    scopes: z.array(ConsentScope),
  }),
);
export type MyStaff = z.infer<typeof MyStaff>;

export const StaffDashboard = z.array(
  z.object({
    member_id: z.uuid(),
    display_name: z.string(),
    scopes: z.array(ConsentScope),
  }),
);
export type StaffDashboard = z.infer<typeof StaffDashboard>;

export const AdminUsers = z.array(
  z.object({
    user_id: z.uuid(),
    display_name: z.string(),
    facility_id: z.uuid().nullable(),
    roles: z.array(AppRole),
  }),
);
export type AdminUsers = z.infer<typeof AdminUsers>;

export const AdminAssignments = z.array(
  z.object({
    assignment_id: z.uuid(),
    staff_id: z.uuid(),
    staff_name: z.string(),
    member_id: z.uuid(),
    member_name: z.string(),
    started_at: z.string(),
  }),
);
export type AdminAssignments = z.infer<typeof AdminAssignments>;

/** admin-invite-user Edge Function の入力 */
export const InviteUserRequest = z
  .object({
    email: z.email().max(254),
    display_name: DisplayName,
    role: z.enum(['member', 'staff']),
    facility_id: z.uuid().nullable(),
  })
  .strict();
export type InviteUserRequest = z.infer<typeof InviteUserRequest>;

export const NullData = z.null();
