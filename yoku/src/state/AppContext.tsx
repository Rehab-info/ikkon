import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { destroyDb, getDb, type YokuDB } from "../db/db";
import { loadSettings, saveSettings } from "../db/repo";
import { seedDemo } from "../db/demo";
import type { DataMode, Settings } from "../db/types";
import { DEFAULT_SETTINGS } from "../db/types";

const MODE_KEY = "yoku.mode";

function readMode(): DataMode {
  try {
    return localStorage.getItem(MODE_KEY) === "demo" ? "demo" : "real";
  } catch {
    return "real";
  }
}

function writeMode(mode: DataMode) {
  try {
    if (mode === "demo") localStorage.setItem(MODE_KEY, "demo");
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* 保存できない環境では、このタブの間だけデモになる */
  }
}

interface AppState {
  mode: DataMode;
  db: YokuDB;
  settings: Settings;
  ready: boolean;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  enterDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
  /** 実データとデモデータをすべて削除する */
  deleteEverything: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children, initialMode }: { children: ReactNode; initialMode?: DataMode }) {
  const [mode, setMode] = useState<DataMode>(() => initialMode ?? readMode());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // どの DB の読みこみが終わったか。mode を切り替えた直後の描画で、古い ready を使わないようにする
  const [readyDb, setReadyDb] = useState<YokuDB | null>(null);
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const db = useMemo(() => getDb(mode), [mode, generation]);
  const ready = readyDb === db;

  useEffect(() => {
    if (busy) return;
    let alive = true;
    (async () => {
      if (mode === "demo") {
        const isDemo = await db.meta.get("isDemo");
        if (!isDemo) {
          const real = await loadSettings(getDb("real"));
          await seedDemo(db);
          await saveSettings(db, { theme: real.theme });
        }
      }
      const s = await loadSettings(db);
      if (alive) {
        setSettings(s);
        setReadyDb(db);
      }
    })().catch((e) => {
      console.error(e);
      if (alive) setReadyDb(db);
    });
    return () => {
      alive = false;
    };
  }, [db, mode, busy]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      setSettings((s) => ({ ...s, ...patch }));
      setSettings(await saveSettings(db, patch));
    },
    [db]
  );

  const enterDemo = useCallback(async () => {
    await destroyDb("demo");
    writeMode("demo");
    setMode("demo");
  }, []);

  const exitDemo = useCallback(async () => {
    writeMode("real");
    setMode("real");
    await destroyDb("demo");
  }, []);

  const deleteEverything = useCallback(async () => {
    // 先に画面を外し、開いているライブクエリ(DB 接続)を止めてから消す
    setReadyDb(null);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 0));
    await destroyDb("real");
    await destroyDb("demo");
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* noop */
    }
    setSettings(DEFAULT_SETTINGS);
    setMode("real");
    // 同じ mode のままでも作り直した空の DB を開き直す
    setGeneration((g) => g + 1);
    setBusy(false);
    window.location.hash = "#/";
  }, []);

  const value = useMemo<AppState>(
    () => ({ mode, db, settings, ready, updateSettings, enterDemo, exitDemo, deleteEverything }),
    [mode, db, settings, ready, updateSettings, enterDemo, exitDemo, deleteEverything]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
