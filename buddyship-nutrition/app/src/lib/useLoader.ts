import { useCallback, useEffect, useState } from 'react';

/**
 * 画面表示時の読み込み。失敗したら表示中のデータを捨てる(権限が外れたあとに古いデータを見せない)。
 * reload() で読み直す(reload(true) なら古いデータを消してから)。
 */
export function useLoader<T>(load: () => Promise<T>): {
  data: T | null;
  error: unknown;
  /** 読み直す。clear = true なら、読み終わるまで古いデータを見せない(保存直後など) */
  reload: (clear?: boolean) => void;
} {
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
  const reload = useCallback((clear = false) => {
    if (clear) setState({ data: null, error: null });
    setVersion((v) => v + 1);
  }, []);
  return { ...state, reload };
}
