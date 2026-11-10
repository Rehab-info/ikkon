#!/usr/bin/env node
/**
 * ローカル開発用の架空アカウントを作る(ローカルの Supabase 専用。他の環境では動かない)。
 *   管理者 dev-admin@example.test / スタッフ dev-staff@example.test / 利用者 dev-member@example.test
 *   パスワードはすべて Dev-only-12345
 */
import { execFileSync } from 'node:child_process';

const raw = execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const s = JSON.parse(raw.slice(raw.indexOf('{')));
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(s.API_URL) || !/@(127\.0\.0\.1|localhost):\d+\//.test(s.DB_URL)) {
  throw new Error('seed-dev-users runs only against a local Supabase stack');
}
const ORG = '00000000-0000-4000-8000-000000000001';
const FACILITY = '00000000-0000-4000-8000-000000000101';
const users = [
  ['dev-admin@example.test', '開発用管理者', 'admin'],
  ['dev-staff@example.test', '開発用スタッフ', 'staff'],
  ['dev-member@example.test', '開発用利用者', 'member'],
];
const ids = {};
for (const [email, name, role] of users) {
  const res = await fetch(`${s.API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: s.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${s.SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: 'Dev-only-12345', email_confirm: true }),
  });
  if (!res.ok) throw new Error(`${email}: ${res.status} (already exists? run "npx supabase db reset" first)`);
  ids[role] = (await res.json()).id;
  execFileSync('psql', [
    s.DB_URL,
    '-v',
    'ON_ERROR_STOP=1',
    '-qc',
    `insert into public.profiles(user_id, organization_id, facility_id, display_name) values ('${ids[role]}', '${ORG}', '${FACILITY}', '${name}');
     insert into public.user_roles(user_id, organization_id, role) values ('${ids[role]}', '${ORG}', '${role}');`,
  ]);
}
execFileSync('psql', [
  s.DB_URL,
  '-v',
  'ON_ERROR_STOP=1',
  '-qc',
  `insert into public.staff_assignments(organization_id, staff_id, member_id, created_by) values ('${ORG}', '${ids.staff}', '${ids.member}', '${ids.admin}');`,
]);
console.log('created: dev-admin / dev-staff / dev-member @example.test (password: Dev-only-12345)');
