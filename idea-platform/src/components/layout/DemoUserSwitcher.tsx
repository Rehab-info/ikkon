import { UserRound } from 'lucide-react'
import { useId } from 'react'
import { useDemoUser } from '../../context/demoUser'
import { ROLE_LABEL } from '../../lib/labels'

/** デモ用の利用者切り替え（ログインではありません） */
export function DemoUserSwitcher({ compact = false }: { compact?: boolean }) {
  const { user, users, switchUser } = useDemoUser()
  const id = useId()
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'rounded-md border border-line px-2 py-1'}`}>
      <UserRound className="size-4 text-muted" aria-hidden />
      <label htmlFor={id} className="sr-only">
        デモ利用者の切り替え（認証ではありません）
      </label>
      <select
        id={id}
        value={user.id}
        onChange={(e) => switchUser(e.target.value)}
        className="max-w-[12rem] bg-transparent py-1 text-sm text-ink focus:outline-none"
        data-testid="demo-user-switcher"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {ROLE_LABEL[u.role]}：{u.displayName.replace(/（.*）/, '')}
          </option>
        ))}
      </select>
    </div>
  )
}
