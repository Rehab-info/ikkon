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
  writeFileSync(ACCOUNTS_FILE, JSON.stringify({ admin, staff, member, tag }));
}
