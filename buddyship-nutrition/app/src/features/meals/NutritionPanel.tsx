import { displayTotal, sourceNotice, type MealSummary } from '@buddyship/nutrition';
import { cn } from '@/lib/utils.ts';

const ROWS = [
  ['energy_kcal', 'エネルギー', 'kcal'],
  ['protein_g', 'たんぱく質', 'g'],
  ['fat_g', '脂質', 'g'],
  ['carbohydrate_g', '炭水化物', 'g'],
] as const;

/**
 * 栄養値の表示。見出しと注記は @buddyship/nutrition が決める:
 *  要確認があれば「確認済み食品のみの小計」+「未確認の食品は含まれていません」、なければ「推定摂取量」。
 * 小計のときは枠を点線にし、数値の前に「小計」と書いて、すべて確認済みの推定摂取量と見た目でも区別する。
 */
export function NutritionPanel({
  summary,
  heading,
  notes,
}: {
  summary: MealSummary;
  heading: string;
  notes: string[];
}) {
  const subtotal = summary.scope === 'confirmed_only_subtotal';
  return (
    <section
      aria-labelledby="nutrition-heading"
      data-testid="nutrition-panel"
      data-scope={summary.scope}
      className={cn(
        'rounded-2xl border-4 p-5',
        subtotal ? 'border-dashed border-line bg-surface-muted' : 'border-brand bg-surface',
      )}
    >
      <h2 id="nutrition-heading" data-testid="nutrition-heading" className="mb-3 text-xl font-bold">
        {heading}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-lg">
        {ROWS.map(([n, label, unit]) => (
          <div key={n} className="contents">
            <dt className="font-bold">{label}</dt>
            <dd data-testid={`nutrition-${n}`}>
              {subtotal && <span className="mr-1 text-base">小計</span>}
              {displayTotal(n, summary.totals[n], summary.precision)} {unit}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="mt-3 flex flex-col gap-1 text-base">
        {notes.map((n) => (
          <li key={n} className={n.startsWith('未確認') ? 'font-bold' : 'text-ink-muted'}>
            {n.startsWith('未確認') && <span aria-hidden="true">⚠ </span>}
            {n}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-muted">{sourceNotice()}</p>
    </section>
  );
}
