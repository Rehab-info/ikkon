import { useCallback } from 'react';
import { Link } from 'react-router';
import { dayTotalHeading, displayValue, mealTotalHeading } from '@buddyship/nutrition';
import { SLOT_LABELS, type DailySummary, type SavedMeal, type SlotStatus } from '@buddyship/shared';
import { api } from '@/lib/api.ts';
import { addDays, formatDateJa, todayJst } from '@/lib/date.ts';
import { useLoader } from '@/lib/useLoader.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';
import { useMemberTarget, type MemberTarget } from './useMemberTarget.ts';

const STATUS_TEXT: Record<SlotStatus, string> = {
  recorded: '✓ 記録あり',
  skipped: 'ー 食べなかった',
  dayservice: 'デ デイサービス(記録しません)',
};

/** 記録の一覧(SCREENS M-09)。本人、または同意のある担当スタッフ */
export function MealHistoryPage() {
  const { target, error } = useMemberTarget();
  if (error) return <ErrorNotice error={error} />;
  if (!target) return <Loading />;
  return <History target={target} />;
}

function History({ target }: { target: MemberTarget }) {
  const to = todayJst();
  const from = addDays(to, -6);
  const canRead = target.self || target.scopes.includes('meals:read');
  const canWrite = target.self || target.scopes.includes('meals:write');
  const load = useCallback(async () => {
    const meals = await api.getMeals(target.memberId, from, to);
    // 日別の記録状況は meals:read が必要(代理入力だけのスタッフは自分の入力分だけ見る。D-07)
    const days = canRead ? await api.getDailySummary(target.memberId, from, to) : null;
    return { meals, days };
  }, [target.memberId, from, to, canRead]);
  const { data, error } = useLoader(load);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{target.self ? 'これまでの記録' : `${target.name} さんの食事の記録`}</h1>
      {canWrite && (
        <Button asChild>
          <Link to={target.self ? '/meals/new' : `/members/${target.memberId}/meals/new`}>
            {target.self ? 'ごはんを記録する' : '代わりに記録する'}
          </Link>
        </Button>
      )}
      <ErrorNotice error={error} />
      {!data && !error && <Loading />}
      {data && !data.days && <p className="text-lg">あなたが代わりに入力した記録だけを表示しています。</p>}
      {data &&
        (data.days ?? datesOf(from, to)).map((d) => (
          <DayCard
            key={d.date}
            day={d}
            meals={data.meals.filter((m) => m.eaten_on === d.date)}
            showTotals={data.days !== null}
          />
        ))}
    </div>
  );
}

function datesOf(from: string, to: string): DailySummary {
  const out: DailySummary = [];
  for (let d = to; d >= from; d = addDays(d, -1)) {
    out.push({
      date: d,
      slots: { breakfast: null, lunch: null, dinner: null },
      meal_count: 0,
      needs_review_count: 0,
      totals: { energy_kcal: 0, protein_g: 0, fat_g: 0, carbohydrate_g: 0 },
    });
  }
  return out;
}

function DayCard({ day, meals, showTotals }: { day: DailySummary[number]; meals: SavedMeal[]; showTotals: boolean }) {
  const h = dayTotalHeading(day.slots, day.needs_review_count);
  const approximate = meals.some((m) => m.display_precision === 'approximate');
  const precision = approximate ? 'approximate' : 'normal';
  return (
    <Card data-testid="day-card" data-date={day.date}>
      <CardTitle>{formatDateJa(day.date)}</CardTitle>
      {showTotals && (
        <ul className="mb-3 flex flex-col gap-1 text-lg" aria-label="記録の状況">
          {(['breakfast', 'lunch', 'dinner'] as const).map((s) => (
            <li key={s}>
              {SLOT_LABELS[s]}:{day.slots[s] ? STATUS_TEXT[day.slots[s]] : 'まだ記録していません'}
            </li>
          ))}
        </ul>
      )}
      {showTotals && meals.length > 0 && (
        <div className="mb-3 rounded-xl bg-surface-muted p-3" data-testid="day-total">
          <p className="text-lg font-bold" data-testid="day-total-heading">
            {h.heading}
          </p>
          <p className="text-lg">
            {day.needs_review_count > 0 && <span className="mr-1 text-base">小計</span>}
            エネルギー {displayValue('energy_kcal', Math.round(day.totals.energy_kcal * 100), precision)}{' '}
            kcal/たんぱく質 {displayValue('protein_g', Math.round(day.totals.protein_g * 100), precision)} g/脂質{' '}
            {displayValue('fat_g', Math.round(day.totals.fat_g * 100), precision)} g/炭水化物{' '}
            {displayValue('carbohydrate_g', Math.round(day.totals.carbohydrate_g * 100), precision)} g
          </p>
          <p className="text-base">{h.note}</p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {meals.map((m) => {
          const mh = mealTotalHeading({
            scope: m.needs_review_count > 0 ? 'confirmed_only_subtotal' : 'all_confirmed',
            needsReviewCount: m.needs_review_count,
            reasons: m.display_precision === 'approximate' ? ['unknown_composition'] : [],
          });
          return (
            <li key={m.meal_id}>
              <Button asChild variant="quiet" className="justify-start text-left">
                <Link to={`/meals/${m.meal_id}`} data-testid="meal-link">
                  {SLOT_LABELS[m.slot]}:{mh.heading}{' '}
                  {displayValue('energy_kcal', Math.round(m.totals.energy_kcal * 100), m.display_precision)} kcal
                  {m.needs_review_count > 0 ? `(要確認 ${m.needs_review_count} 品)` : ''}
                  {m.entry_source === 'staff' ? '(スタッフ入力)' : ''}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
