import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppError, SLOT_LABELS, type MealSlot } from '@buddyship/shared';
import { api } from '@/lib/api.ts';
import { addDays, BACKFILL_DAYS, formatDateJa, todayJst } from '@/lib/date.ts';
import { prepareMealPhoto } from '@/lib/image.ts';
import { WizardStep } from '@/components/WizardStep.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';
import { cn } from '@/lib/utils.ts';
import { MealEditor } from './MealEditor.tsx';
import { NutritionPanel } from './NutritionPanel.tsx';
import { fromAnalysis, summarize, toItems, type EditorState } from './editorModel.ts';
import { useMemberTarget } from './useMemberTarget.ts';

type Step = 'when' | 'where' | 'photo' | 'edit' | 'confirm' | 'done';

/** 食事を記録する(SCREENS M-02〜M-07)。本人と、meals:write の担当スタッフ(代理入力)が使う */
export function RecordMealPage() {
  const navigate = useNavigate();
  const { target, error: targetError } = useMemberTarget();
  const [step, setStep] = useState<Step>('when');
  const [date, setDate] = useState(todayJst());
  const [slot, setSlot] = useState<MealSlot | null>(null);
  const [state, setState] = useState<EditorState>({ dishes: [], lines: [] });
  const [analysis, setAnalysis] = useState<{ id: string; provider: string; imagePath: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [doneText, setDoneText] = useState('');

  if (targetError) return <ErrorNotice error={targetError} />;
  if (!target) return <Loading />;
  const canWrite = target.self || target.scopes.includes('meals:write');
  if (!canWrite) return <ErrorNotice error={new AppError('forbidden')} />;
  const today = todayJst();
  const backTo = target.self ? '/meals' : `/members/${target.memberId}/meals`;

  async function markSlot(status: 'skipped' | 'dayservice') {
    if (!slot || !target) return;
    setBusy('保存しています');
    setError(null);
    try {
      await api.setSlotStatus(target.memberId, date, slot, status);
      setDoneText(
        status === 'dayservice' ? 'デイサービスで食べた、と記録しました。' : '食べなかった、と記録しました。',
      );
      setStep('done');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file || !target) return;
    setError(null);
    try {
      setBusy('写真を準備しています');
      const blob = await prepareMealPhoto(file);
      setBusy('写真を送っています');
      const path = await api.uploadMealImage(target.memberId, blob);
      setBusy('写真から食べものを探しています');
      const res = await api.analyzeMeal(target.memberId, path);
      setAnalysis({ id: res.analysis_id, provider: res.provider, imagePath: path });
      setState(fromAnalysis(res));
      setStep('edit');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!slot || !target) return;
    setBusy('保存しています');
    setError(null);
    try {
      const { meal_id } = await api.saveMeal(target.memberId, {
        slot,
        location: 'home',
        eaten_on: date,
        eaten_at: null,
        eaten_at_precision: 'slot_only',
        info_source: analysis ? 'photo' : target.self ? 'manual' : 'interview',
        analysis_id: analysis?.id ?? null,
        image_path: analysis?.imagePath ?? null,
        items: toItems(state),
      });
      navigate(`/meals/${meal_id}`);
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  }

  const proxyBanner = !target.self && (
    <p className="mb-4 rounded-xl border-2 border-brand p-3 text-lg font-bold" data-testid="proxy-banner">
      {target.name} さんの記録として、あなたが代わりに入力します。
    </p>
  );
  if (busy) return <Loading label={busy} />;

  switch (step) {
    case 'when':
      return (
        <div>
          {proxyBanner}
          <WizardStep
            title="いつの食事ですか?"
            step={{ current: 1, total: 4 }}
            primaryLabel="次へ"
            primaryDisabled={!slot}
            onPrimary={() => setStep('where')}
          >
            <fieldset className="mb-5">
              <legend className="mb-2 text-lg font-bold">日にち</legend>
              <div className="flex flex-wrap gap-2">
                {[today, addDays(today, -1)].map((d, i) => (
                  <Choice key={d} on={date === d} onClick={() => setDate(d)}>
                    {i === 0 ? '今日' : '昨日'}({formatDateJa(d)})
                  </Choice>
                ))}
              </div>
              <label className="mt-3 flex flex-col gap-1 text-lg">
                ほかの日({BACKFILL_DAYS}日前まで)
                <input
                  type="date"
                  value={date}
                  min={addDays(today, -BACKFILL_DAYS)}
                  max={today}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="min-h-14 rounded-xl border-2 border-line px-3 text-lg"
                />
              </label>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-lg font-bold">どの食事ですか?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((s) => (
                  <Choice key={s} on={slot === s} onClick={() => setSlot(s)}>
                    {SLOT_LABELS[s]}
                  </Choice>
                ))}
              </div>
            </fieldset>
          </WizardStep>
        </div>
      );
    case 'where':
      return (
        <div>
          {proxyBanner}
          <WizardStep
            title="どこで食べましたか?"
            step={{ current: 2, total: 4 }}
            primaryLabel="自宅で食べた"
            onPrimary={() => setStep('photo')}
            onBack={() => setStep('when')}
          >
            <p className="mb-4 text-lg">
              このアプリでは、ご自宅で食べた食事だけを記録します。デイサービスで食べた食事は記録しません。
            </p>
            {slot !== 'snack' && (
              <div className="flex flex-col gap-3">
                <Button variant="quiet" onClick={() => void markSlot('dayservice')}>
                  デイサービスで食べた
                </Button>
                <Button variant="quiet" onClick={() => void markSlot('skipped')}>
                  食べなかった
                </Button>
              </div>
            )}
            <ErrorNotice error={error} />
          </WizardStep>
        </div>
      );
    case 'photo':
      return (
        <div>
          {proxyBanner}
          <WizardStep
            title="食事の写真"
            step={{ current: 3, total: 4 }}
            primaryLabel="写真なしで記録する"
            onPrimary={() => setStep('edit')}
            onBack={() => setStep('where')}
          >
            <p className="mb-4 text-lg">
              料理全体が写るように撮ってください。家族の顔や、郵便物・お薬の袋などは写さないでください。
            </p>
            <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl bg-brand px-5 py-3 text-lg font-bold text-white">
              写真を撮る・選ぶ
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                data-testid="photo-input"
                onChange={(e) => void onPhoto(e.target.files?.[0])}
              />
            </label>
            <ErrorNotice error={error} />
          </WizardStep>
        </div>
      );
    case 'edit': {
      const { summary, heading } = summarize(state);
      return (
        <div className="flex flex-col gap-5">
          {proxyBanner}
          <h1 className="text-2xl font-bold">食べたものと量の確認</h1>
          {analysis?.provider === 'mock' && (
            <p className="rounded-xl border-2 border-alert p-3 text-lg font-bold" data-testid="mock-banner">
              開発用の仮の解析です。写真の中身は見ておらず、決まった例を表示しています。
            </p>
          )}
          {analysis && <p className="text-lg">写真からの推定です。違っていたら直してください。</p>}
          {state.lines.length === 0 && (
            <p className="text-lg">「+ 食べものを足す」から、食べたものを探して足してください。</p>
          )}
          <MealEditor state={state} onChange={setState} />
          <NutritionPanel summary={summary} heading={heading.heading} notes={heading.notes} />
          <div className="sticky bottom-0 flex flex-col gap-3 bg-surface py-4">
            <Button onClick={() => setStep('confirm')} disabled={state.lines.length === 0}>
              確認へ
            </Button>
            <Button variant="quiet" onClick={() => setStep('photo')}>
              戻る
            </Button>
          </div>
        </div>
      );
    }
    case 'confirm': {
      const { summary, heading } = summarize(state);
      return (
        <div>
          {proxyBanner}
          <WizardStep
            title="確認して保存"
            step={{ current: 4, total: 4 }}
            primaryLabel="この内容で保存する"
            onPrimary={() => void save()}
            onBack={() => setStep('edit')}
          >
            <p className="mb-3 text-lg">
              {formatDateJa(date)} の{slot ? SLOT_LABELS[slot] : ''}(自宅)
            </p>
            <ul className="mb-4 flex flex-col gap-1 text-lg" aria-label="記録する食べもの">
              {state.lines.map((l) => (
                <li key={l.key}>
                  {l.status === 'needs_review' ? '⚠ 要確認:' : '・'}
                  {l.label} {l.servedG} g({l.intakePercent}%)
                </li>
              ))}
            </ul>
            {summary.needsReviewCount > 0 && (
              <p className="mb-4 rounded-xl border-2 border-alert p-3 text-lg font-bold" data-testid="save-with-review">
                要確認の食品が {summary.needsReviewCount}{' '}
                品あります。このまま保存すると「確認済み食品のみの小計」として記録され、要確認の食品は含まれません。あとから直せます。
              </p>
            )}
            <NutritionPanel summary={summary} heading={heading.heading} notes={heading.notes} />
            <ErrorNotice error={error} />
          </WizardStep>
        </div>
      );
    }
    case 'done':
      return (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">記録しました</h1>
          <p className="text-lg" role="status">
            {doneText}
          </p>
          <Button onClick={() => navigate(backTo)}>記録の一覧へ</Button>
        </div>
      );
  }
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'min-h-14 rounded-xl border-2 px-4 text-lg font-bold',
        on ? 'border-brand bg-brand text-white' : 'border-line',
      )}
    >
      {children}
    </button>
  );
}
