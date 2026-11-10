import { useState } from 'react';
import type { FontScale } from '@buddyship/shared';
import { useSession } from '@/lib/session.tsx';
import { api } from '@/lib/api.ts';
import { applyFontScale, FONT_SCALE_LABELS } from '@/lib/font.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { ErrorNotice } from '@/components/ErrorNotice.tsx';
import { AboutApp } from '@/components/AboutApp.tsx';
import { cn } from '@/lib/utils.ts';

export function SettingsPage() {
  const { context, reload, signOut } = useSession();
  const [error, setError] = useState<unknown>(null);
  if (!context?.registered) return null;

  async function setScale(scale: FontScale) {
    if (!context?.registered) return;
    applyFontScale(scale);
    try {
      await api.updateMyProfile({ font_scale: scale }, context.user_id);
      await reload();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">設定</h1>
      <Card>
        <CardTitle id="font-size-title">文字の大きさ</CardTitle>
        <div role="radiogroup" aria-labelledby="font-size-title" className="flex flex-col gap-3">
          {([0, 1, 2] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={context.font_scale === s}
              onClick={() => void setScale(s)}
              className={cn(
                'min-h-14 rounded-xl border-2 px-4 text-left text-lg font-bold',
                context.font_scale === s ? 'border-brand bg-brand text-white' : 'border-line',
              )}
            >
              <span aria-hidden="true">{context.font_scale === s ? '● ' : '○ '}</span>
              {FONT_SCALE_LABELS[s]}
            </button>
          ))}
        </div>
      </Card>
      <ErrorNotice error={error} />
      <AboutApp />
      <Button variant="quiet" onClick={() => void signOut()}>
        ログアウト
      </Button>
    </div>
  );
}
