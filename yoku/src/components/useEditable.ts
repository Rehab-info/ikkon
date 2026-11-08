import { useEffect, useState } from "react";
import type { Table } from "dexie";

/** 編集画面で、id があれば既存データを読みこむ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEditable<T>(table: Table<T, string, any>, id: string | undefined) {
  const [state, setState] = useState<{ loaded: boolean; item: T | undefined }>({ loaded: !id, item: undefined });
  useEffect(() => {
    if (!id) {
      setState({ loaded: true, item: undefined });
      return;
    }
    let alive = true;
    setState({ loaded: false, item: undefined });
    void table.get(id).then((item) => {
      if (alive) setState({ loaded: true, item });
    });
    return () => {
      alive = false;
    };
  }, [table, id]);
  return state;
}
