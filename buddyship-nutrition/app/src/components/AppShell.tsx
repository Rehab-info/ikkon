import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import type { AppRole } from '@buddyship/shared';
import { useSession } from '@/lib/session.tsx';
import { useIdleTimeout } from '@/lib/idle.ts';
import { cn } from '@/lib/utils.ts';

export const STAFF_IDLE_MS = 15 * 60 * 1000; // スタッフ・管理者の自動ログアウト(仮:15 分。SECURITY §2)

const NAV: { to: string; label: string; role: AppRole }[] = [
  { to: '/', label: 'ホーム', role: 'member' },
  { to: '/sharing', label: '見せる情報', role: 'member' },
  { to: '/staff', label: '担当の利用者', role: 'staff' },
  { to: '/admin', label: '利用者とスタッフ', role: 'admin' },
  { to: '/admin/assignments', label: '担当の割り当て', role: 'admin' },
];

export function AppShell({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { signOut, context } = useSession();
  const privileged = roles.includes('staff') || roles.includes('admin');
  useIdleTimeout(privileged, STAFF_IDLE_MS, () => void signOut());
  const items = NAV.filter((n) => roles.includes(n.role));

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line py-4">
        <p className="text-lg font-bold">{context?.registered ? `${context.display_name} さん` : ''}</p>
        <NavLink
          to="/settings"
          className="rounded-lg px-3 py-2 text-lg font-bold text-brand underline underline-offset-4"
        >
          設定
        </NavLink>
      </header>
      {items.length > 1 && (
        <nav aria-label="メニュー" className="my-4 flex flex-wrap gap-2">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-14 items-center rounded-xl border-2 px-4 text-lg font-bold',
                  isActive ? 'border-brand bg-brand text-white' : 'border-line text-ink',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className="pt-4">{children}</main>
    </div>
  );
}
