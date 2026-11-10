import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { displayAmount } from '@buddyship/nutrition';
import { ROLE_LABELS, SLOT_LABELS, type SavedMeal } from '@buddyship/shared';
import { api } from '@/lib/api.ts';
import { formatDateJa } from '@/lib/date.ts';
import { useLoader } from '@/lib/useLoader.ts';
import { useSession } from '@/lib/session.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/alert-dialog.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';
import { MealEditor } from './MealEditor.tsx';
import { NutritionPanel } from './NutritionPanel.tsx';
import { fromSavedMeal, lineNutrients, summarize, toItems, type EditorState } from './editorModel.ts';

/**
 * 食事の詳細・修正・削除(SCREENS M-10)。
 * 表示する栄養値は、保存された明細(成分値・量)から @buddyship/nutrition で計算し直したもの。
 * サーバーが保存した合計と一致することを確かめ、違えば表示しない(保存・再表示の一致)。
 */
export function MealDetailPage() {
  const { mealId = '' } = useParams();
  const navigate = useNavigate();
  const { context } = useSession();
  const load = useCallback(() => api.getMeal(mealId), [mealId]);
  const { data: meal, error: loadError, reload } = useLoader(load);
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const me = context?.registered ? context.user_id : null;
  const isSelf = meal !== null && meal.member_id === me;

  useEffect(() => {
    if (!meal?.has_image || !isSelf) return;
    let url: string | null = null;
    api.mealImageUrl(meal.meal_id).then(
      (u) => {
        url = u;
        setImageUrl(u);
      },
      () => setImageUrl(null),
    );
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [meal?.meal_id, meal?.has_image, isSelf]);

  if (loadError) return <ErrorNotice error={loadError} />;
  if (!meal) return <Loading />;
  const canEdit = isSelf || meal.entered_by_me;
  const listPath = isSelf ? '/meals' : `/members/${meal.member_id}/meals`;

  async function saveEdit() {
    if (!editing || !meal) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateMeal(meal.meal_id, payloadOf(meal, editing));
      setEditing(null);
      reload(true); // 保存前の値を一瞬でも見せない
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!meal) return;
    setBusy(true);
    try {
      await api.deleteMeal(meal.meal_id);
      navigate(listPath);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  if (editing) {
    const { summary, heading } = summarize(editing);
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold">記録を直す</h1>
        <MealEditor state={editing} onChange={setEditing} />
        <NutritionPanel summary={summary} heading={heading.heading} notes={heading.notes} />
        <ErrorNotice error={error} />
        <div className="sticky bottom-0 flex flex-col gap-3 bg-surface py-4">
          <Button onClick={() => void saveEdit()} disabled={busy || editing.lines.length === 0}>
            直した内容で保存する
          </Button>
          <Button variant="quiet" onClick={() => setEditing(null)}>
            直さずに戻る
          </Button>
        </div>
      </div>
    );
  }

  const state = fromSavedMeal(meal);
  const { summary, heading } = summarize(state);
  const consistent = (['energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g'] as const).every(
    (n) => Math.round(meal.totals[n] * 100) === summary.totals[n].hundredths,
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">
        {formatDateJa(meal.eaten_on)} の{SLOT_LABELS[meal.slot]}
      </h1>
      <p className="text-lg">
        自宅で食べた食事
        {meal.entry_source === 'staff' && (
          <span
            className="ml-2 rounded-lg border-2 border-line px-2 py-1 text-base font-bold"
            data-testid="staff-entry"
          >
            スタッフ入力({meal.entered_by_name ?? 'スタッフ'})
          </span>
        )}
      </p>
      {imageUrl && (
        <img src={imageUrl} alt="記録した食事の写真" className="max-h-80 w-full rounded-xl object-contain" />
      )}
      <ul className="flex flex-col gap-3" aria-label="食べたもの">
        {state.lines.map((l) => {
          const n = lineNutrients(l);
          return (
            <li
              key={l.key}
              className="rounded-xl border-2 border-line p-3"
              data-testid="saved-line"
              data-status={l.status}
            >
              <p className="text-lg font-bold">
                {l.status === 'needs_review' && <span className="text-alert">⚠ 要確認:</span>}
                {l.label}
                <span className="ml-2 text-base font-normal text-ink-muted">
                  {ROLE_LABELS[l.role]}
                  {l.dishKey ? `(${state.dishes.find((d) => d.key === l.dishKey)?.label ?? '料理'})` : ''}
                </span>
              </p>
              <p className="text-lg">
                {l.servedG} g のうち {l.intakePercent}%
              </p>
              {n ? (
                <p className="text-base text-ink-muted">推定:{displayAmount('energy_kcal', n.energy_kcal)} kcal</p>
              ) : (
                <p className="text-base">確認が済んでいないため、栄養の計算に入っていません。</p>
              )}
            </li>
          );
        })}
      </ul>
      {consistent ? (
        <NutritionPanel summary={summary} heading={heading.heading} notes={heading.notes} />
      ) : (
        <p role="alert" className="rounded-xl border-2 border-alert p-4 text-lg font-bold text-alert">
          栄養の値を確かめられませんでした。時間をおいて開き直してください。
        </p>
      )}
      <ErrorNotice error={error} />
      {canEdit && (
        <Button variant="secondary" onClick={() => setEditing(state)}>
          {meal.needs_review_count > 0 ? '要確認の食品を直す' : 'この記録を直す'}
        </Button>
      )}
      {isSelf && (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          この記録を消す
        </Button>
      )}
      <Button variant="quiet" onClick={() => navigate(listPath)}>
        記録の一覧へ
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="この記録を消しますか"
        description="消した記録はもとに戻せません。"
        confirmLabel="消す"
        cancelLabel="消さない"
        danger
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function payloadOf(meal: SavedMeal, s: EditorState) {
  return {
    slot: meal.slot,
    location: 'home' as const,
    eaten_on: meal.eaten_on,
    eaten_at: meal.eaten_at,
    eaten_at_precision: meal.eaten_at_precision,
    info_source: meal.info_source,
    // 解析記録と画像はサーバーが保存済みの値を使う(付け替え不可)
    analysis_id: null,
    image_path: null,
    items: toItems(s),
  };
}
