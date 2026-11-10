import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { readLocalSupabase } from './local-supabase.ts';

export const E2E_PASSWORD = 'E2e-only-12345';
export const ACCOUNTS_FILE = new URL('./.accounts.json', import.meta.url).pathname;

const ORG = '00000000-0000-4000-8000-000000000001';
const FACILITY = '00000000-0000-4000-8000-000000000101';

/** E2E 用の架空アカウントを作る(毎回新しいメールアドレス) */
export default async function globalSetup(): Promise<void> {
  const sb = readLocalSupabase();
  const tag = randomUUID().slice(0, 8);
  const create = async (label: string) => {
    const email = `e2e-${label}-${tag}@example.test`;
    const res = await fetch(`${sb.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: sb.service, Authorization: `Bearer ${sb.service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: E2E_PASSWORD, email_confirm: true }),
    });
    if (!res.ok) throw new Error(`createUser ${res.status}`);
    const { id } = (await res.json()) as { id: string };
    return { id, email };
  };
  const admin = await create('admin');
  const staff = await create('staff');
  const member = await create('member');
  const sql = `
    insert into public.profiles(user_id, organization_id, facility_id, display_name) values
      ('${admin.id}', '${ORG}', '${FACILITY}', 'E2E管理者-${tag}'),
      ('${staff.id}', '${ORG}', '${FACILITY}', 'E2Eスタッフ-${tag}'),
      ('${member.id}', '${ORG}', '${FACILITY}', 'E2E利用者-${tag}');
    insert into public.user_roles(user_id, organization_id, role) values
      ('${admin.id}', '${ORG}', 'admin'), ('${staff.id}', '${ORG}', 'staff'), ('${member.id}', '${ORG}', 'member');
    insert into public.staff_assignments(organization_id, staff_id, member_id, created_by)
      values ('${ORG}', '${staff.id}', '${member.id}', '${admin.id}');`;
  execFileSync('psql', [sb.db, '-v', 'ON_ERROR_STOP=1', '-qc', sql]);

  // 食事記録の E2E 用(Sprint 2):規約に同意済みの利用者と、食事の閲覧・代理入力の同意がある担当スタッフ
  const mealMember = await create('meal-member');
  const mealStaff = await create('meal-staff');
  const sql2 = `
    insert into public.profiles(user_id, organization_id, facility_id, display_name) values
      ('${mealMember.id}', '${ORG}', '${FACILITY}', '食事テスト利用者-${tag}'),
      ('${mealStaff.id}', '${ORG}', '${FACILITY}', '食事テストスタッフ-${tag}');
    insert into public.user_roles(user_id, organization_id, role) values
      ('${mealMember.id}', '${ORG}', 'member'), ('${mealStaff.id}', '${ORG}', 'staff');
    insert into public.staff_assignments(organization_id, staff_id, member_id, created_by)
      values ('${ORG}', '${mealStaff.id}', '${mealMember.id}', '${admin.id}');
    insert into public.user_agreements(user_id, document_id)
      select u, d.id from unnest(array['${mealMember.id}', '${mealStaff.id}']::uuid[]) u, public.consent_documents d;
    insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
      select '${mealMember.id}', '${mealStaff.id}', s::public.consent_scope, (select id from public.consent_documents where kind = 'staff_sharing')
      from unnest(array['meals:read', 'meals:write']) s;`;
  execFileSync('psql', [sb.db, '-v', 'ON_ERROR_STOP=1', '-qc', sql2]);
  // 体組成の E2E 用(Sprint 3):体の測定の閲覧・代理入力と食事の閲覧の同意があるスタッフ、担当外のスタッフ
  const bodyMember = await create('body-member');
  const bodyStaff = await create('body-staff');
  const otherStaff = await create('other-staff');
  const sql3 = `
    insert into public.profiles(user_id, organization_id, facility_id, display_name) values
      ('${bodyMember.id}', '${ORG}', '${FACILITY}', '体テスト利用者-${tag}'),
      ('${bodyStaff.id}', '${ORG}', '${FACILITY}', '体テストスタッフ-${tag}'),
      ('${otherStaff.id}', '${ORG}', '${FACILITY}', '担当外スタッフ-${tag}');
    insert into public.user_roles(user_id, organization_id, role) values
      ('${bodyMember.id}', '${ORG}', 'member'), ('${bodyStaff.id}', '${ORG}', 'staff'), ('${otherStaff.id}', '${ORG}', 'staff');
    insert into public.staff_assignments(organization_id, staff_id, member_id, created_by)
      values ('${ORG}', '${bodyStaff.id}', '${bodyMember.id}', '${admin.id}');
    insert into public.user_agreements(user_id, document_id)
      select u, d.id from unnest(array['${bodyMember.id}', '${bodyStaff.id}', '${otherStaff.id}']::uuid[]) u, public.consent_documents d;
    insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
      select '${bodyMember.id}', '${bodyStaff.id}', s::public.consent_scope, (select id from public.consent_documents where kind = 'staff_sharing')
      from unnest(array['meals:read', 'body:read', 'body:write']) s;`;
  execFileSync('psql', [sb.db, '-v', 'ON_ERROR_STOP=1', '-qc', sql3]);
  writeFileSync(
    ACCOUNTS_FILE,
    JSON.stringify({ admin, staff, member, mealMember, mealStaff, bodyMember, bodyStaff, otherStaff, tag }),
  );
}
