import { useState } from 'react';
import type { AdminAssignments } from '@buddyship/shared';
import { useLoader } from '@/lib/useLoader.ts';
import { api } from '@/lib/api.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { Label } from '@/components/ui/label.tsx';
import { ConfirmDialog } from '@/components/ui/alert-dialog.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';

async function loadAssignmentsPage() {
  const [users, rows] = await Promise.all([api.adminListUsers(), api.adminListAssignments()]);
  return { users, rows };
}

/** 担当の割り当て(A-02)。終了すると、その組の同意も自動で撤回される(D-07) */
export function AdminAssignmentsPage() {
  const { data, error: loadError, reload } = useLoader(loadAssignmentsPage);
  const users = data?.users ?? null;
  const rows = data?.rows ?? null;
  const [staffId, setStaffId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [ending, setEnding] = useState<AdminAssignments[number] | null>(null);
  const [actionError, setError] = useState<unknown>(null);
  const error = actionError ?? loadError;

  async function assign() {
    setError(null);
    try {
      await api.adminAssign(staffId, memberId);
      setStaffId('');
      setMemberId('');
      reload();
    } catch (e) {
      setError(e);
    }
  }

  async function end(id: string) {
    setError(null);
    try {
      await api.adminEndAssignment(id);
      reload();
    } catch (e) {
      setError(e);
    }
  }

  if (!users && !error) return <Loading />;
  const staff = users?.filter((u) => u.roles.includes('staff')) ?? [];
  const members = users?.filter((u) => u.roles.includes('member')) ?? [];
  const select = 'min-h-14 w-full rounded-xl border-2 border-line bg-surface px-3 text-lg';

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">担当の割り当て</h1>
      <Card>
        <CardTitle>新しく割り当てる</CardTitle>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="as-staff">スタッフ</Label>
            <select id="as-staff" className={select} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">選んでください</option>
              {staff.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="as-member">利用者</Label>
            <select id="as-member" className={select} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">選んでください</option>
              {members.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => void assign()} disabled={!staffId || !memberId}>
            割り当てる
          </Button>
          <p className="text-base text-ink-muted">
            割り当てただけでは記録は見られません。利用者本人が「見せる」を選んだ項目だけ見られます。
          </p>
        </div>
      </Card>
      <ErrorNotice error={error} />
      <ul className="flex flex-col gap-3">
        {rows?.map((r) => (
          <li
            key={r.assignment_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-line p-4"
            data-testid="assignment"
          >
            <span className="text-lg font-bold">
              {r.staff_name} → {r.member_name} さん
            </span>
            <Button width="auto" variant="danger" onClick={() => setEnding(r)}>
              担当を終える
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(o) => !o && setEnding(null)}
        title="担当を終えますか"
        description={
          ending
            ? `${ending.staff_name}さんは${ending.member_name}さんの担当ではなくなり、本人が選んでいた「見せる・任せる」もすべて取り消されます。`
            : ''
        }
        confirmLabel="担当を終える"
        danger
        onConfirm={() => ending && void end(ending.assignment_id)}
      />
    </div>
  );
}
