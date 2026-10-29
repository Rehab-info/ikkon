import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

export interface LiveResult<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
}

interface Snapshot<T> {
  key: string
  data: T | undefined
  error: Error | undefined
}

/**
 * IndexedDB の内容を購読し、変更があれば自動で再描画する。
 * deps が変わったときだけクエリを作り直す（deps はプリミティブ値を想定）。
 */
export function useLiveData<T>(query: () => Promise<T>, deps: readonly unknown[]): LiveResult<T> {
  const key = JSON.stringify(deps)
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null)

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (data) => setSnapshot({ key, data, error: undefined }),
      error: (error: unknown) =>
        setSnapshot({ key, data: undefined, error: error instanceof Error ? error : new Error(String(error)) }),
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // deps が変わった直後は、前のクエリの結果を返さない
  if (!snapshot || snapshot.key !== key) return { data: undefined, error: undefined, loading: true }
  return { data: snapshot.data, error: snapshot.error, loading: false }
}
