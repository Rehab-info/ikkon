import { useCallback, useId, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BODY_CONDITION_LABELS, BODY_LABELS, BODY_METRICS, type BodyHistory, type BodyRecord } from '@buddyship/shared';
import { api } from '@/lib/api.ts';
import { addDays, todayJst } from '@/lib/date.ts';
import { useLoader } from '@/lib/useLoader.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { ConfirmDialog } from '@/components/ui/alert-dialog.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';
import { useMemberTarget, type MemberTarget } from '@/features/meals/useMemberTarget.ts';
import { bodyBase } from './BodyRecordPage.tsx';
import {
  CHART_METRICS,
  PERIODS,
  chartPoints,
  diffText,
  formatDateTime,
  formatShortDate,
  hasDeviceChange,
  hasMixedConditions,
  type ChartMetric,
  type ChartPoint,
} from './bodyModel.ts';

/**
 * 体の変化(M-12)。体重・骨格筋量・体脂肪率を、それぞれ自分の単位の別のグラフで示す
 * (単位の違う値を同じ目盛りに載せない)。良し悪しの判定・色分け・目標線は出さない(SAFE / D-15)。
 */
export function BodyPage() {
  const { target, error: targetError } = useMemberTarget();
  if (targetError) return <ErrorNotice error={targetError} />;
  if (!target) return <Loading />;
  if (!target.scopes.includes('body:read') && !target.scopes.includes('body:write')) {
    return <p className="text-lg">この方の体の測定を見る同意がありません。</p>;
  }
  return <BodyView target={target} />;
}

function BodyView({ target }: { target: MemberTarget }) {
  const location = useLocation();
  const saved = (location.state as { saved?: boolean } | null)?.saved === true;
  const [months, setMonths] = useState<number>(3);
  const [asTable, setAsTable] = useState(false);
  const to = todayJst();
  const from = addDays(to, -Math.round(months * 30.5));
  const load = useCallback(() => api.getBodyRecords(target.memberId, from, to), [target.memberId, from, to]);
  const { data: rows, error, reload } = useLoader(load);
  const base = bodyBase(target);
  const canWrite = target.scopes.includes('body:write');

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{target.self ? '体の変化' : `${target.name} さんの体の変化`}</h1>
      {saved && (
        <p role="status" data-testid="body-saved" className="rounded-lg bg-surface-muted p-3 text-lg font-bold">
          ✓ 保存しました
        </p>
      )}
      {canWrite && (
        <Button asChild>
          <Link to={`${base}/new`}>{target.self ? '体の測定を記録する' : '体の測定を代わりに記録する'}</Link>
        </Button>
      )}
      {!target.self && !target.scopes.includes('body:read') && (
        <p className="text-lg">記録を見る同意がないため、あなたが入力した記録だけを表示しています。</p>
      )}

      <div role="group" aria-label="表示する期間" className="grid grid-cols-4 gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.months}
            width="auto"
            variant={months === p.months ? 'primary' : 'quiet'}
            aria-pressed={months === p.months}
            onClick={() => setMonths(p.months)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <Button variant="secondary" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
        {asTable ? 'グラフで見る' : '表で見る'}
      </Button>

      <ErrorNotice error={error} />
      {!rows && !error && <Loading />}
      {rows?.length === 0 && (
        <p className="text-lg" data-testid="body-empty">
          この期間の記録はありません。
        </p>
      )}
      {rows && rows.length > 0 && (
        <>
          <Notes rows={rows} />
          {asTable ? (
            <BodyTable rows={rows} target={target} onChanged={() => reload(true)} />
          ) : (
            CHART_METRICS.map((m) => <MetricChart key={m} metric={m} rows={rows} from={from} to={to} />)
          )}
          {!asTable && <BodyList rows={rows} target={target} onChanged={() => reload(true)} />}
        </>
      )}
    </div>
  );
}

function Notes({ rows }: { rows: BodyRecord[] }) {
  return (
    <div className="rounded-xl bg-surface-muted p-4 text-base" data-testid="body-notes">
      <p>
        測る時間帯・食事・運動・機械によって、同じ体でも数字は変わります。グラフは変化の様子を見るためのもので、良い・悪いを判断するものではありません。
      </p>
      {hasDeviceChange(rows) && (
        <p className="mt-2 font-bold" data-testid="device-note">
          <span aria-hidden="true">ⓘ </span>
          この期間に測った機械が変わっています。機械が変わった前後の数字は、そのまま比べられないことがあります(グラフの点線)。
        </p>
      )}
      {hasMixedConditions(rows) && (
        <p className="mt-2 font-bold" data-testid="condition-note">
          <span aria-hidden="true">ⓘ </span>食事の前と後の測定が混ざっています。
        </p>
      )}
    </div>
  );
}

const SERIES = '#1d4ed8'; // 1 グラフ 1 系列。色は区別のためだけ(良し悪しの意味を持たせない)
const GRID = '#e5e7eb';
const AXIS = '#374151';

function MetricChart(props: { metric: ChartMetric; rows: BodyRecord[]; from: string; to: string }) {
  const { metric } = props;
  const { label, unit } = BODY_LABELS[metric];
  const titleId = useId();
  const points = chartPoints(props.rows, metric);
  const values = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const x0 = Date.parse(`${props.from}T00:00:00+09:00`);
  const x1 = Date.parse(`${props.to}T23:59:59+09:00`);
  const last = points.at(-1);
  if (!last) return null;
  const summary = `${label}のグラフ。${points.length} 回の測定。最新は ${formatDateTime(last.t)} の ${last.value.toFixed(1)} ${unit}。`;
  return (
    <Card data-testid={`chart-${metric}`}>
      <CardTitle id={titleId}>
        {label}({unit})
      </CardTitle>
      <p className="mb-2 text-lg">
        最新:<strong>{last.value.toFixed(1)}</strong> {unit}({formatDateTime(last.t)})
      </p>
      <div role="img" aria-labelledby={titleId} aria-description={summary} className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[x0, x1]}
              tickFormatter={formatShortDate}
              tick={{ fill: AXIS, fontSize: 14 }}
              stroke={AXIS}
              tickCount={4}
            />
            <YAxis
              domain={[lo, hi]}
              allowDecimals={false}
              tick={{ fill: AXIS, fontSize: 14 }}
              stroke={AXIS}
              width={44}
              tickCount={4}
            />
            {points
              .filter((p) => p.deviceChanged)
              .map((p) => (
                <ReferenceLine
                  key={p.t}
                  x={p.t}
                  stroke={AXIS}
                  strokeDasharray="4 4"
                  label={{ value: '機械が変わった', position: 'insideTopLeft', fill: AXIS, fontSize: 13 }}
                />
              ))}
            <Tooltip content={<PointTooltip unit={unit} />} cursor={{ stroke: AXIS, strokeWidth: 1 }} />
            <Line
              dataKey="value"
              stroke={SERIES}
              strokeWidth={2}
              dot={{ r: 4, fill: SERIES, stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 7, fill: SERIES, stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function PointTooltip(props: { unit: string; active?: boolean; payload?: readonly { payload: ChartPoint }[] }) {
  const p = props.active ? props.payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-lg border-2 border-line bg-surface p-2 text-base shadow">
      <p>{formatDateTime(p.t)}</p>
      <p className="font-bold">
        {p.value.toFixed(1)} {props.unit}
      </p>
      <p>機械:{p.device}</p>
    </div>
  );
}

/** 修正できるか:本人は全部、スタッフは自分の代理入力で 7 日以内(サーバーでも判定する) */
const canEdit = (r: BodyRecord, t: MemberTarget) =>
  t.self ||
  (t.scopes.includes('body:write') &&
    r.entered_by_me === true &&
    Date.now() - Date.parse(r.recorded_at) < 7 * 86_400_000);

/** 表(グラフと同じ値を数字で。新しい順) */
function BodyTable(props: { rows: BodyRecord[]; target: MemberTarget; onChanged: () => void }) {
  const sorted = [...props.rows].reverse();
  return (
    <div className="overflow-x-auto" data-testid="body-table">
      <table className="w-full border-collapse text-left text-lg">
        <caption className="mb-2 text-left text-base">
          新しい順。前回差は数字だけで、良い・悪いを表すものではありません。
        </caption>
        <thead>
          <tr className="border-b-2 border-line">
            <th scope="col" className="p-2">
              測った日時
            </th>
            {BODY_METRICS.map((m) => (
              <th key={m} scope="col" className="p-2">
                {BODY_LABELS[m].label}
                <br />
                <span className="text-base font-normal">({BODY_LABELS[m].unit}・前回差)</span>
              </th>
            ))}
            <th scope="col" className="p-2">
              機械・条件
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id} className="border-b border-line align-top">
              <th scope="row" className="p-2 font-normal">
                {formatDateTime(r.measured_at)}
              </th>
              {BODY_METRICS.map((m) => (
                <td key={m} className="p-2">
                  {r[m].toFixed(1)}
                  <br />
                  <span className="text-base">{diffText(r[m], sorted[i + 1]?.[m], m)}</span>
                </td>
              ))}
              <td className="p-2 text-base">
                {r.device_model}
                <br />
                {BODY_CONDITION_LABELS[r.condition]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 記録の一覧(修正・履歴・削除) */
function BodyList(props: { rows: BodyRecord[]; target: MemberTarget; onChanged: () => void }) {
  const { target } = props;
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BodyRecord | null>(null);
  const [error, setError] = useState<unknown>(null);
  const base = bodyBase(target);
  const remove = async () => {
    if (!deleting) return;
    setError(null);
    try {
      await api.deleteBody(deleting.id);
      setDeleting(null);
      props.onChanged();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Card>
      <CardTitle>記録(新しい順)</CardTitle>
      <ErrorNotice error={error} />
      <ul className="flex flex-col gap-4">
        {[...props.rows].reverse().map((r) => (
          <li key={r.id} className="rounded-xl border-2 border-line p-3" data-testid="body-record">
            <p className="text-lg font-bold">{formatDateTime(r.measured_at)}</p>
            <p className="text-lg">
              体重 {r.weight_kg.toFixed(1)} kg・骨格筋量 {r.skeletal_muscle_kg.toFixed(1)} kg・体脂肪量{' '}
              {r.body_fat_kg.toFixed(1)} kg・体脂肪率 {r.body_fat_pct.toFixed(1)} %
            </p>
            <p className="text-base">
              {r.device_model}・{BODY_CONDITION_LABELS[r.condition]}
              {r.entry_source === 'staff' && (
                <span data-testid="staff-entry">・スタッフ入力({r.entered_by_name ?? '退職したスタッフ'})</span>
              )}
              {r.edited && <span>・修正あり</span>}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {canEdit(r, target) && (
                <Button asChild variant="secondary">
                  <Link to={`${base}/${r.id}/edit`}>この記録を直す</Link>
                </Button>
              )}
              <Button variant="quiet" onClick={() => setHistoryOf(historyOf === r.id ? null : r.id)}>
                {historyOf === r.id ? '変更の履歴を閉じる' : '変更の履歴'}
              </Button>
              {historyOf === r.id && <HistoryView id={r.id} />}
              {target.self && (
                <Button variant="danger" onClick={() => setDeleting(r)}>
                  この記録を消す
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="この記録を消しますか?"
        description="消した記録はグラフと一覧から消えます。消す前の数字は、変更の履歴に残ります。"
        confirmLabel="消す"
        danger
        onConfirm={() => void remove()}
      />
    </Card>
  );
}

const OP_LABELS: Record<BodyHistory[number]['op'], string> = { insert: '記録', update: '修正', delete: '削除' };

function HistoryView({ id }: { id: string }) {
  const load = useCallback(() => api.getBodyHistory(id), [id]);
  const { data, error } = useLoader(load);
  if (error) return <ErrorNotice error={error} />;
  if (!data) return <Loading />;
  return (
    <ol className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3 text-base" data-testid="body-history">
      {data.map((h, i) => (
        <li key={i}>
          <strong>
            {formatDateTime(h.changed_at)} {OP_LABELS[h.op]}
          </strong>
          ({h.changed_by_me ? 'あなた' : (h.changed_by_name ?? '—')})
          <br />
          体重 {h.snapshot.weight_kg.toFixed(1)}・骨格筋量 {h.snapshot.skeletal_muscle_kg.toFixed(1)}・体脂肪量{' '}
          {h.snapshot.body_fat_kg.toFixed(1)}・体脂肪率 {h.snapshot.body_fat_pct.toFixed(1)}・測定{' '}
          {formatDateTime(h.snapshot.measured_at)}
        </li>
      ))}
    </ol>
  );
}
