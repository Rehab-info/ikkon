import { createContext, useContext } from 'react'
import type { User } from '../types'

export interface DemoUserContextValue {
  user: User
  users: User[]
  switchUser: (id: string) => void
}

export const DemoUserContext = createContext<DemoUserContextValue | null>(null)

export function useDemoUser(): DemoUserContextValue {
  const ctx = useContext(DemoUserContext)
  if (!ctx) throw new Error('DemoUserProvider の内側で使用してください。')
  return ctx
}
