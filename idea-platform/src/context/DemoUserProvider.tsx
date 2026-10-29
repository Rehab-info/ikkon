import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { db } from '../db/database'
import { useLiveData } from '../hooks/useLiveData'
import { DemoUserContext } from './demoUser'

const STORAGE_KEY = 'idea-platform:demo-user'

function readStoredId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'u_buyer'
  } catch {
    return 'u_buyer'
  }
}

/** デモ利用者の切り替え。認証ではありません。 */
export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(readStoredId)
  const { data: users } = useLiveData(() => db.users.toArray(), [])

  const switchUser = useCallback((id: string) => {
    setUserId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // 保存できない環境（プライベートモード等）では、この画面の間だけ切り替える
    }
  }, [])

  const value = useMemo(() => {
    if (!users || users.length === 0) return null
    const user = users.find((u) => u.id === userId) ?? users[0]
    return { user, users, switchUser }
  }, [users, userId, switchUser])

  if (!value) return null
  return <DemoUserContext.Provider value={value}>{children}</DemoUserContext.Provider>
}
