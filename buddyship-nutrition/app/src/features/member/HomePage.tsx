import { useCallback } from 'react';
import { Link } from 'react-router';
import { dayTotalHeading, displayValue } from '@buddyship/nutrition';
import { SLOT_LABELS } from '@buddyship/shared';
import { api } from '@/lib/api.ts';
import { formatDateJa, todayJst } from '@/lib/date.ts';
import { useLoader } from '@/lib/useLoader.ts';
import { useSession } from '@/lib/session.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';

/** 本人のホーム(M-01):今日の記録状況と、記録済みの自宅食事の推定摂取量(要確認があれば小計) */
export function HomePage() {
  const { context } = useSession();
  const memberId = context?.registered ? context.user_id : '';
  const today = todayJst();
  const load = useCallback(() => api.getDailySummary(memberId, today, today), [memberId, today]);
  const { data, error } = useLoader(load);
  const day = data?.[0];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">ホーム</h1>
      <Card>
        <CardTitle>{formatDateJa(today)} 今日の自宅の食事</CardTitle>
        <ErrorNotice error={error} />
        {!day && !error && <Loading />}
        {day && (
          <>
            <ul className="mb-3 flex flex-col gap-1 text-lg" data-testid="today-slots">
              {(['breakfast', 'lunch', 'dinner'] as const).map((s) => (
                <li key={s}>
                  {SLOT_LABELS[s]}:
                  {day.slots[s] === 'recorded'
                    ? '✓ 記録しました'
                    : day.slots[s] === 'skipped'
                      ? 'ー 食べなかった'
                      : day.slots[s] === 'dayservice'
                        ? 'デイサービス(記録しません)'
                        : 'まだ記録していません'}
                </li>
              ))}
            </ul>
            {day.meal_count > 0 && (
              <div className="rounded-xl bg-surface-muted p-3" data-testid="today-total">
                <p className="text-lg font-bold">{dayTotalHeading(day.slots, day.needs_review_count).heading}</p>
                <p className="text-2xl font-bold">
                  {day.needs_review_count > 0 && <span className="mr-1 text-base">小計</span>}
                  {displayValue('energy_kcal', Math.round(day.totals.energy_kcal * 100))} kcal
                </p>
                <p className="text-base">{dayTotalHeading(day.slots, day.needs_review_count).note}</p>
              </div>
            )}
          </>
        )}
      </Card>
      <Button asChild>
        <Link to="/meals/new">ごはんを記録する</Link>
      </Button>
      <Button asChild variant="secondary">
        <Link to="/meals">これまでの記録</Link>
      </Button>
      <Button asChild variant="quiet">
        <Link to="/sharing">担当スタッフに見せる情報を決める</Link>
      </Button>
    </div>
  );
}
