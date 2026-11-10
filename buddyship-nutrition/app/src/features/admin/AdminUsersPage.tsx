import { useState, type FormEvent } from 'react';
import { InviteUserRequest } from '@buddyship/shared';
import { useLoader } from '@/lib/useLoader.ts';
import { api } from '@/lib/api.ts';
import { useSession } from '@/lib/session.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';

const ROLE_LABEL = { member: '利用者', staff: 'スタッフ', admin: '管理者' } as const;

/** 利用者・スタッフの登録と一覧(A-01)。健康データ・同意の中身は表示しない */
export function AdminUsersPage() {
  const { context } = useSession();
  const { data: users, error: loadError, reload } = useLoader(api.adminListUsers);
  const [actionError, setError] = useState<unknown>(null);
  const error = actionError ?? loadError;
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', display_name: '', role: 'member' as 'member' | 'staff' });

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const facility = context?.registered ? context.facility_id : null;
    const parsed = InviteUserRequest.safeParse({ ...form, facility_id: facility });
    if (!parsed.success) {
      setNotice('メールアドレスと名前を確かめてください。');
      return;
    }
    try {
      await api.adminInvite(parsed.data);
      setNotice(`${parsed.data.display_name} さんに招待メールを送りました。`);
      setForm({ email: '', display_name: '', role: 'member' });
      reload();
    } catch (err) {
      setError(err);
    }
  }

  async function toggleStaff(userId: string, active: boolean) {
    setError(null);
    try {
      await api.adminSetRole(userId, 'staff', active);
      reload();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">利用者とスタッフ</h1>
      <Card>
        <CardTitle>招待する</CardTitle>
        <form onSubmit={invite} className="flex flex-col gap-4" noValidate>
          <div>
            <Label htmlFor="inv-email">メールアドレス</Label>
            <Input
              id="inv-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="inv-name">表示名(アプリに出る名前)</Label>
            <Input
              id="inv-name"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-lg font-bold">種類</legend>
            <div className="flex gap-3">
              {(['member', 'staff'] as const).map((r) => (
                <label
                  key={r}
                  className="flex min-h-14 flex-1 items-center gap-3 rounded-xl border-2 border-line px-4 text-lg font-bold"
                >
                  <input
                    type="radio"
                    name="role"
                    className="size-6"
                    checked={form.role === r}
                    onChange={() => setForm({ ...form, role: r })}
                  />
                  {ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit">招待メールを送る</Button>
        </form>
        {notice && (
          <p role="status" className="mt-4 text-lg font-bold">
            {notice}
          </p>
        )}
      </Card>
      <ErrorNotice error={error} />
      {!users && !error && <Loading />}
      <ul className="flex flex-col gap-3">
        {users?.map((u) => (
          <li
            key={u.user_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-line p-4"
            data-testid="admin-user"
          >
            <span className="text-lg font-bold">
              {u.display_name}
              <span className="ml-2 font-normal">({u.roles.map((r) => ROLE_LABEL[r]).join('・') || 'ロールなし'})</span>
            </span>
            {context?.registered && u.user_id !== context.user_id && !u.roles.includes('member') && (
              <Button
                width="auto"
                variant={u.roles.includes('staff') ? 'danger' : 'secondary'}
                onClick={() => void toggleStaff(u.user_id, !u.roles.includes('staff'))}
              >
                {u.roles.includes('staff') ? 'スタッフを停止' : 'スタッフにする'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
