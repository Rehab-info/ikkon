import { useEffect, useRef } from 'react';

const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * 無操作が続いたら onIdle を呼ぶ(スタッフ・管理者の共用端末向け自動ログアウト。SECURITY §2)。
 * enabled=false のとき(利用者本人の端末)は何もしない。
 */
export function useIdleTimeout(enabled: boolean, ms: number, onIdle: () => void): void {
  const cb = useRef(onIdle);
  useEffect(() => {
    cb.current = onIdle;
  });
  useEffect(() => {
    if (!enabled) return;
    let timer = window.setTimeout(() => cb.current(), ms);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => cb.current(), ms);
    };
    for (const e of EVENTS) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of EVENTS) window.removeEventListener(e, reset);
    };
  }, [enabled, ms]);
}
