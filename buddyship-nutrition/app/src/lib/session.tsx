import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { MyContext } from '@buddyship/shared';
import { supabase } from './supabase.ts';
import { api } from './api.ts';
import { applyFontScale } from './font.ts';

type SessionState = {
  loading: boolean;
  session: Session | null;
  context: MyContext | null;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<MyContext | null>(null);

  const reload = useCallback(async () => {
    try {
      const ctx = await api.myContext();
      setContext(ctx);
      if (ctx.registered) applyFontScale(ctx.font_scale);
    } catch {
      setContext(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await reload();
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') setContext(null);
      if (event === 'SIGNED_IN' || event === 'MFA_CHALLENGE_VERIFIED' || event === 'TOKEN_REFRESHED') {
        // コールバック内で直接 await しない(supabase-js の推奨)
        setTimeout(() => void reload(), 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [reload]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setContext(null);
    setSession(null);
    applyFontScale(0);
    // Service Worker の実行時キャッシュは使っていないが、念のため Cache Storage を消す
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith('workbox-precache')).map((k) => caches.delete(k)));
    }
  }, []);

  const value = useMemo(
    () => ({ loading, session, context, reload, signOut }),
    [loading, session, context, reload, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
