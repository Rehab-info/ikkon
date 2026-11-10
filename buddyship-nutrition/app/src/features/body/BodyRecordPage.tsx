import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  BODY_CONDITION_LABELS,
  BODY_LABELS,
  BODY_LIMITS,
  BODY_WARNING_TEXT,
  BodyCondition,
  bodyConsistent,
  bodyWarnings,
  checkBodyField,
  type BodyMetric,
  type BodyPayload,
  type BodyRecord,
} from '@buddyship/shared';
import { api } from '@/lib/api.ts';
import { addDays, todayJst } from '@/lib/date.ts';
import { useLoader } from '@/lib/useLoader.ts';
import { WizardStep } from '@/components/WizardStep.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';
import { useMemberTarget, type MemberTarget } from '@/features/meals/useMemberTarget.ts';
import { formatDateTime, fromLocalInput, parseNumberInput, stepValue, toLocalInput } from './bodyModel.ts';

/** 入力の並び(InBody の結果用紙の並びに合わせる。機種確認後に調整 D-12) */
const NUMBER_STEPS = ['weight_kg', 'skeletal_muscle_kg', 'body_fat_kg', 'body_fat_pct'] as const;
const TOTAL = NUMBER_STEPS.length + 4; // + 測定日時・機種・測定の条件・確認

type Draft = Record<BodyMetric, number | null> & { measuredLocal: string; device: string; condition: BodyCondition };

export const bodyBase = (t: MemberTarget) => (t.self ? '/body' : `/members/${t.memberId}/body`);

/** InBody を記録・修正する(M-11)。本人、または body:write の担当スタッフ(代理入力) */
export function BodyRecordPage() {
  const { target, error: targetError } = useMemberTarget();
  const { recordId } = useParams();
  const load = useCallback(async () => {
    if (!target) return null;
    // 前回の値(参考表示・機種の初期値)と、修正するときはその記録
    const rows = await api.getBodyRecords(target.memberId, addDays(todayJst(), -400), todayJst());
    return { rows, editing: recordId ? (rows.find((r) => r.id === recordId) ?? null) : null };
  }, [target, recordId]);
  const { data, error } = useLoader(load);

  if (targetError || error) return <ErrorNotice error={targetError ?? error} />;
  if (!target || !data) return <Loading />;
  if (!target.scopes.includes('body:write')) {
    return <p className="text-lg">この方の体の測定を代わりに記録する同意がありません。</p>;
  }
  if (recordId && !data.editing) return <p className="text-lg">この記録は見つかりませんでした。</p>;
  return <BodyWizard target={target} rows={data.rows} editing={data.editing} />;
}

function BodyWizard(props: { target: MemberTarget; rows: BodyRecord[]; editing: BodyRecord | null }) {
  const { target, editing } = props;
  const navigate = useNavigate();
  const previous = props.rows.at(-1);
  const [step, setStep] = useState(0);
  // 画面を開いた時刻(測定日時の範囲の判定用)
  const [openedAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    weight_kg: editing?.weight_kg ?? null,
    skeletal_muscle_kg: editing?.skeletal_muscle_kg ?? null,
    body_fat_kg: editing?.body_fat_kg ?? null,
    body_fat_pct: editing?.body_fat_pct ?? null,
    measuredLocal: toLocalInput(editing?.measured_at ?? new Date().toISOString()),
    device: editing?.device_model ?? previous?.device_model ?? '',
    condition: editing?.condition ?? 'unknown',
  }));
  const back = step > 0 ? () => setStep(step - 1) : () => navigate(-1);
  const next = () => setStep(step + 1);
  const title = (t: string) => (target.self ? t : `${target.name} さんの${t}`);

  const metric = NUMBER_STEPS[step];
  if (metric !== undefined) {
    const err = checkBodyField(metric, draft[metric]);
    return (
      <WizardStep
        step={{ current: step + 1, total: TOTAL }}
        title={title(`${BODY_LABELS[metric].label}は?`)}
        primaryLabel="次へ"
        primaryDisabled={err !== null}
        onPrimary={next}
        onBack={back}
      >
        {!target.self && <ProxyNote target={target} />}
        <NumberField
          key={metric}
          metric={metric}
          value={draft[metric]}
          previous={previous?.[metric]}
          onChange={(v) => setDraft({ ...draft, [metric]: v })}
        />
      </WizardStep>
    );
  }

  const measuredAt = fromLocalInput(draft.measuredLocal);
  if (step === NUMBER_STEPS.length) {
    const t = measuredAt ? Date.parse(measuredAt) : NaN;
    const bad = Number.isNaN(t) || t > openedAt + 10 * 60_000 || t < openedAt - 365 * 86_400_000;
    return (
      <WizardStep
        step={{ current: step + 1, total: TOTAL }}
        title="いつ測りましたか?"
        primaryLabel="次へ"
        primaryDisabled={bad}
        onPrimary={next}
        onBack={back}
      >
        <label className="flex flex-col gap-2 text-lg">
          測った日と時刻
          <input
            type="datetime-local"
            value={draft.measuredLocal}
            max={toLocalInput(new Date(openedAt).toISOString())}
            onChange={(e) => setDraft({ ...draft, measuredLocal: e.target.value })}
            className="min-h-14 rounded-xl border-2 border-line px-3 text-lg"
          />
        </label>
        <p className="mt-3 text-base">結果用紙に印刷された日時を入れてください。1 年前までさかのぼれます。</p>
        {bad && (
          <p className="mt-3 text-lg font-bold text-alert" role="alert">
            <span aria-hidden="true">⚠ </span>先の日時や、1 年より前の日時は入れられません。
          </p>
        )}
      </WizardStep>
    );
  }

  if (step === NUMBER_STEPS.length + 1) {
    const device = draft.device.trim();
    return (
      <WizardStep
        step={{ current: step + 1, total: TOTAL }}
        title="測った機械の名前は?"
        primaryLabel="次へ"
        primaryDisabled={device.length < 1 || device.length > 50}
        onPrimary={next}
        onBack={back}
      >
        <label className="flex flex-col gap-2 text-lg">
          機種(結果用紙の上の方に書かれています)
          <input
            value={draft.device}
            maxLength={50}
            onChange={(e) => setDraft({ ...draft, device: e.target.value })}
            className="min-h-14 rounded-xl border-2 border-line px-3 text-lg"
          />
        </label>
        <p className="mt-3 text-base">機械が変わると、同じ体でも数字が変わることがあります。</p>
      </WizardStep>
    );
  }

  if (step === NUMBER_STEPS.length + 2) {
    return (
      <WizardStep
        step={{ current: step + 1, total: TOTAL }}
        title="食事の前でしたか、後でしたか?"
        primaryLabel="次へ"
        onPrimary={next}
        onBack={back}
      >
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="測定の条件">
          {BodyCondition.options.map((c) => (
            <Button
              key={c}
              role="radio"
              aria-checked={draft.condition === c}
              variant={draft.condition === c ? 'primary' : 'quiet'}
              onClick={() => setDraft({ ...draft, condition: c })}
            >
              {draft.condition === c ? '✓ ' : ''}
              {BODY_CONDITION_LABELS[c]}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-base">食事や運動のすぐ後は、数字が変わりやすくなります。</p>
      </WizardStep>
    );
  }

  // 確認
  const payload: BodyPayload | null =
    measuredAt &&
    draft.weight_kg !== null &&
    draft.skeletal_muscle_kg !== null &&
    draft.body_fat_kg !== null &&
    draft.body_fat_pct !== null
      ? {
          measured_at: measuredAt,
          weight_kg: draft.weight_kg,
          skeletal_muscle_kg: draft.skeletal_muscle_kg,
          body_fat_kg: draft.body_fat_kg,
          body_fat_pct: draft.body_fat_pct,
          device_model: draft.device.trim(),
          condition: draft.condition,
        }
      : null;
  const consistent = payload ? bodyConsistent(payload) : false;
  const warnings = payload ? bodyWarnings(payload) : [];
  const save = async () => {
    if (!payload) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) await api.updateBody(editing.id, payload);
      else await api.saveBody(target.memberId, payload);
      navigate(bodyBase(target), { state: { saved: true } });
    } catch (e) {
      setSaveError(e);
      setSaving(false);
    }
  };
  return (
    <WizardStep
      step={{ current: TOTAL, total: TOTAL }}
      title="この内容で保存しますか?"
      primaryLabel={saving ? '保存しています' : editing ? '直した内容で保存する' : 'この内容で保存する'}
      primaryDisabled={!payload || !consistent || saving}
      onPrimary={save}
      onBack={back}
    >
      {!target.self && <ProxyNote target={target} />}
      {payload && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-lg" data-testid="body-confirm">
          {NUMBER_STEPS.map((m) => (
            <div key={m} className="contents">
              <dt className="font-bold">{BODY_LABELS[m].label}</dt>
              <dd>
                {payload[m].toFixed(1)} {BODY_LABELS[m].unit}
              </dd>
            </div>
          ))}
          <dt className="font-bold">測った日時</dt>
          <dd>{formatDateTime(payload.measured_at)}</dd>
          <dt className="font-bold">機種</dt>
          <dd>{payload.device_model}</dd>
          <dt className="font-bold">測定の条件</dt>
          <dd>{BODY_CONDITION_LABELS[payload.condition]}</dd>
        </dl>
      )}
      {payload && !consistent && (
        <p className="mt-4 text-lg font-bold text-alert" role="alert">
          <span aria-hidden="true">⚠ </span>
          骨格筋量と体脂肪量を足すと体重以上になっています。数字を確かめてください(このままでは保存できません)。
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="mt-4 rounded-lg bg-surface-muted p-3 text-lg" data-testid="body-warning">
          <span aria-hidden="true">ⓘ </span>
          {BODY_WARNING_TEXT[w]}
        </p>
      ))}
      <ErrorNotice error={saveError} />
    </WizardStep>
  );
}

function ProxyNote({ target }: { target: MemberTarget }) {
  return (
    <p className="mb-4 rounded-lg bg-surface-muted p-3 text-lg" data-testid="proxy-banner">
      {target.name} さんの記録として、あなたが入力します。
    </p>
  );
}

const ERROR_TEXT = {
  required: '数字を入れてください。',
  decimal: '小数は 1 けたまでです(例:52.4)。',
  out_of_range: '',
} as const;

/** 数の入力(大きな −/+ と、直接の入力。結果用紙の数字をそのまま写す) */
function NumberField(props: {
  metric: (typeof NUMBER_STEPS)[number];
  value: number | null;
  previous: number | undefined;
  onChange: (v: number | null) => void;
}) {
  const { metric, value } = props;
  const { label, unit } = BODY_LABELS[metric];
  const { min, max } = BODY_LIMITS[metric];
  const [text, setText] = useState(value === null ? '' : value.toFixed(1));
  const err = text === '' ? null : checkBodyField(metric, value);
  const set = (v: number) => {
    props.onChange(v);
    setText(v.toFixed(1));
  };
  const start = value ?? props.previous ?? min;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-lg">
        結果用紙の「{label}」の数字
        <span className="flex items-center gap-2">
          <input
            inputMode="decimal"
            autoComplete="off"
            value={text}
            aria-invalid={err !== null}
            onChange={(e) => {
              setText(e.target.value);
              props.onChange(parseNumberInput(e.target.value));
            }}
            className="min-h-16 w-40 rounded-xl border-2 border-line px-3 text-3xl font-bold"
          />
          <span className="text-2xl font-bold">{unit}</span>
        </span>
      </label>
      <div className="grid grid-cols-4 gap-2">
        <Button variant="quiet" aria-label={`${label}を 1 減らす`} onClick={() => set(stepValue(start, -10, min, max))}>
          −1
        </Button>
        <Button
          variant="quiet"
          aria-label={`${label}を 0.1 減らす`}
          onClick={() => set(stepValue(start, -1, min, max))}
        >
          −0.1
        </Button>
        <Button variant="quiet" aria-label={`${label}を 0.1 増やす`} onClick={() => set(stepValue(start, 1, min, max))}>
          +0.1
        </Button>
        <Button variant="quiet" aria-label={`${label}を 1 増やす`} onClick={() => set(stepValue(start, 10, min, max))}>
          +1
        </Button>
      </div>
      {props.previous !== undefined && (
        <p className="text-base">
          前回の記録:{props.previous.toFixed(1)} {unit}
        </p>
      )}
      {err && (
        <p className="text-lg font-bold text-alert" role="alert">
          <span aria-hidden="true">⚠ </span>
          {err === 'out_of_range' ? `${min}〜${max} ${unit} の間で入れてください。` : ERROR_TEXT[err]}
        </p>
      )}
    </div>
  );
}
