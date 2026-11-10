import { useState } from 'react';
import { displayAmount } from '@buddyship/nutrition';
import { ROLE_LABELS, type ComponentRole, type FoodRef } from '@buddyship/shared';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { ConfirmDialog } from '@/components/ui/alert-dialog.tsx';
import { cn } from '@/lib/utils.ts';
import { FoodSearch } from './FoodSearch.tsx';
import {
  INTAKE_CHOICES,
  addLine,
  chooseFood,
  lineNutrients,
  removeLine,
  setDishCompositionKnown,
  setIntake,
  setServed,
  type EditorLine,
  type EditorState,
} from './editorModel.ts';

const DEFAULT_GRAMS: Record<ComponentRole, number> = { food: 100, ingredient: 50, cooking_oil: 5, seasoning: 5 };

/** 食べたものと量の確認・修正(SCREENS M-05・M-06)。1 品ずつ大きなカードで並べる */
export function MealEditor({ state, onChange }: { state: EditorState; onChange: (s: EditorState) => void }) {
  const [adding, setAdding] = useState<{ role: ComponentRole; dishKey: string | null } | null>(null);
  const [removing, setRemoving] = useState<EditorLine | null>(null);
  const standalone = state.lines.filter((l) => l.dishKey === null);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-surface-muted p-4">
        <p className="mb-2 text-lg font-bold">全部まとめて、どれくらい食べましたか?</p>
        <div className="flex flex-wrap gap-2">
          {INTAKE_CHOICES.map((c) => (
            <Button key={c.percent} width="auto" variant="quiet" onClick={() => onChange(setIntake(state, c.percent))}>
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {standalone.map((l) => (
        <LineCard key={l.key} line={l} state={state} onChange={onChange} onRemove={() => setRemoving(l)} />
      ))}

      {state.dishes.map((d) => (
        <Card key={d.key} data-testid="dish-card" aria-label={`料理:${d.label}`}>
          <h3 className="mb-3 text-xl font-bold">料理:{d.label}</h3>
          <label className="mb-4 flex min-h-14 items-center gap-3 rounded-xl border-2 border-line px-4 text-lg">
            <input
              type="checkbox"
              className="size-6"
              checked={!d.compositionKnown}
              onChange={(e) => onChange(setDishCompositionKnown(state, d.key, !e.target.checked))}
            />
            中身(材料や量)がはっきりわからない
          </label>
          <div className="flex flex-col gap-4">
            {state.lines
              .filter((l) => l.dishKey === d.key)
              .map((l) => (
                <LineCard key={l.key} line={l} state={state} onChange={onChange} onRemove={() => setRemoving(l)} />
              ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {(['ingredient', 'cooking_oil', 'seasoning'] as const).map((role) => (
              <Button key={role} variant="secondary" onClick={() => setAdding({ role, dishKey: d.key })}>
                + {ROLE_LABELS[role]}を足す
              </Button>
            ))}
          </div>
          {adding?.dishKey === d.key && (
            <div className="mt-3">
              <FoodSearch
                label={`足す${ROLE_LABELS[adding.role]}`}
                onSelect={(f) => {
                  onChange(addLine(state, f, adding.role, d.key, DEFAULT_GRAMS[adding.role]));
                  setAdding(null);
                }}
              />
            </div>
          )}
        </Card>
      ))}

      <Button variant="secondary" onClick={() => setAdding({ role: 'food', dishKey: null })}>
        + 食べものを足す
      </Button>
      {adding?.dishKey === null && (
        <FoodSearch
          onSelect={(f) => {
            onChange(addLine(state, f, 'food', null, DEFAULT_GRAMS.food));
            setAdding(null);
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="この食品を消しますか"
        description={removing ? `「${removing.label}」を記録から消します。` : ''}
        confirmLabel="消す"
        cancelLabel="消さない"
        danger
        onConfirm={() => removing && onChange(removeLine(state, removing.key))}
      />
    </div>
  );
}

function LineCard(props: {
  line: EditorLine;
  state: EditorState;
  onChange: (s: EditorState) => void;
  onRemove: () => void;
}) {
  const { line: l, state, onChange } = props;
  const [searching, setSearching] = useState(false);
  const n = lineNutrients(l);
  const review = l.status === 'needs_review';
  const pick = (f: FoodRef) => {
    onChange(chooseFood(state, l.key, f));
    setSearching(false);
  };

  return (
    <section
      data-testid="meal-line"
      data-status={l.status}
      aria-label={l.label}
      className={cn('rounded-xl border-2 p-4', review ? 'border-dashed border-alert' : 'border-line')}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-lg font-bold">{l.label}</h4>
        <span className="text-base text-ink-muted">{ROLE_LABELS[l.role]}</span>
      </div>
      {review && (
        <div className="mb-3 rounded-lg bg-surface-muted p-3" data-testid="needs-review">
          <p className="mb-2 text-lg font-bold text-alert">
            <span aria-hidden="true">⚠ </span>要確認:どれに近いですか?
          </p>
          <p className="mb-2 text-base">選ぶまで、この食品は栄養の計算に入りません。</p>
          <div className="flex flex-col gap-2">
            {l.candidates.slice(0, 5).map((c) => (
              <Button key={c.food_id} variant="quiet" className="justify-start text-left" onClick={() => pick(c)}>
                {c.display_name}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setSearching(!searching)}>
              ほかの食品を探す
            </Button>
          </div>
          {searching && (
            <div className="mt-3">
              <FoodSearch onSelect={pick} />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">量:</span>
        <Button
          width="auto"
          variant="quiet"
          aria-label={`${l.label}を少なく`}
          onClick={() => onChange(setServed(state, l.key, Math.round(l.servedG * 0.9)))}
        >
          − 少なく
        </Button>
        <label className="flex items-center gap-1 text-lg">
          <span className="sr-only">{l.label}の量(グラム)</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={2000}
            step={1}
            value={l.servedG}
            onChange={(e) => e.target.value !== '' && onChange(setServed(state, l.key, Number(e.target.value)))}
            className="min-h-14 w-28 rounded-xl border-2 border-line px-3 text-lg"
          />
          g
        </label>
        <Button
          width="auto"
          variant="quiet"
          aria-label={`${l.label}を多く`}
          onClick={() => onChange(setServed(state, l.key, Math.round(l.servedG * 1.1)))}
        >
          + 多く
        </Button>
      </div>
      {l.aiEstimatedServedG !== null && l.aiEstimatedServedG !== l.servedG && (
        <p className="mt-1 text-base text-ink-muted">最初の推定:{l.aiEstimatedServedG} g</p>
      )}

      <fieldset className="mt-3">
        <legend className="mb-1 text-lg">どれくらい食べましたか?</legend>
        <div className="flex flex-wrap gap-2">
          {INTAKE_CHOICES.map((c) => (
            <button
              key={c.percent}
              type="button"
              aria-pressed={l.intakePercent === c.percent}
              onClick={() => onChange(setIntake(state, c.percent, l.key))}
              className={cn(
                'min-h-14 rounded-xl border-2 px-3 text-lg font-bold',
                l.intakePercent === c.percent ? 'border-brand bg-brand text-white' : 'border-line',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        {!INTAKE_CHOICES.some((c) => c.percent === l.intakePercent) && (
          <p className="mt-1 text-base">{l.intakePercent}%</p>
        )}
      </fieldset>

      {n && (
        <p className="mt-3 text-base text-ink-muted" data-testid="line-nutrients">
          推定:{displayAmount('energy_kcal', n.energy_kcal)} kcal/たんぱく質 {displayAmount('protein_g', n.protein_g)}{' '}
          g/脂質 {displayAmount('fat_g', n.fat_g)} g/炭水化物 {displayAmount('carbohydrate_g', n.carbohydrate_g)} g
        </p>
      )}
      <div className="mt-3">
        <Button width="auto" variant="danger" onClick={props.onRemove}>
          この食品を消す
        </Button>
      </div>
    </section>
  );
}
