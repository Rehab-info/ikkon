import { useCallback, useEffect, useState } from 'react';

/**
 * 画面表示時の読み込み。失敗したら表示中のデータを捨てる(権限が外れたあとに古いデータを見せない)。
 * reload() で読み直す。
 */
export function useLoader<T>(load: () => Promise<T>): { data: T | null; error: unknown; reload: () => void } {
  const [state, setState] = useState<{ data: T | null; error: unknown }>({ data: null, error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ data, error: null }),
      (error: unknown) => active && setState({ data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [load, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
