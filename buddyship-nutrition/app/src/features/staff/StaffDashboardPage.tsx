import { Link } from 'react-router';
import { SCOPE_LABELS, SCOPE_ORDER, SLOT_LABELS, type StaffDashboard } from '@buddyship/shared';
import { useLoader } from '@/lib/useLoader.ts';
import { api } from '@/lib/api.ts';
import { formatDateJa } from '@/lib/date.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';
import { formatDateTime } from '@/features/body/bodyModel.ts';

type Row = StaffDashboard[number];
const NO_CONSENT = '—(同意なし)';
const NOT_RECORDED = '未記録';
const SLOT_MARK = { recorded: '✓', skipped: 'ー', dayservice: 'デ' } as const;

/**
 * 担当利用者の一覧(T-01)。同意のある列だけ値を示し、同意のない列は「同意なし」(サーバーはデータを返さない)。
 * 記録がなければ「未記録」。体重などの値・評価・色分けは出さない(D-15)。
 * 画面のデータはメモリ上だけに置き、端末に保存しない。
 */
export function StaffDashboardPage() {
  // 拒否されたら表示中のデータを捨てる(useLoader)
  const { data: rows, error, reload } = useLoader(api.staffDashboard);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">担当の利用者</h1>
      <ErrorNotice error={error} />
      {!rows && !error && <Loading />}
      {rows?.length === 0 && <p className="text-lg">担当の利用者はいません。</p>}
      {rows?.map((r) => (
        <Card key={r.member_id} data-testid="member-card">
          <CardTitle>{r.display_name} さん</CardTitle>
          {r.scopes.length === 0 ? (
            <p className="text-lg">— 同意なし(この方の記録は見られません)</p>
          ) : (
            <ul className="flex flex-col gap-1 text-lg" aria-label="同意されている項目">
              {SCOPE_ORDER.filter((s) => r.scopes.includes(s)).map((s) => (
                <li key={s}>✓ {SCOPE_LABELS[s].label}</li>
              ))}
            </ul>
          )}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-lg">
            <dt className="font-bold">自宅の食事の最終記録日</dt>
            <dd data-testid="last-meal">
              {r.meals ? (r.meals.last_meal_on ? formatDateJa(r.meals.last_meal_on) : NOT_RECORDED) : NO_CONSENT}
            </dd>
            <dt className="font-bold">InBody の最新測定日</dt>
            <dd data-testid="last-body">
              {r.body ? (r.body.last_measured_at ? formatDateTime(r.body.last_measured_at) : NOT_RECORDED) : NO_CONSENT}
            </dd>
          </dl>
          {r.meals && <WeekGrid meals={r.meals} name={r.display_name} />}
          <div className="mt-3 flex flex-col gap-2">
            {(r.scopes.includes('meals:read') || r.scopes.includes('meals:write')) && (
              <Button asChild variant="secondary">
                <Link to={`/members/${r.member_id}/meals`}>食事の記録を見る</Link>
              </Button>
            )}
            {r.scopes.includes('meals:write') && (
              <Button asChild>
                <Link to={`/members/${r.member_id}/meals/new`}>食事を代わりに記録する</Link>
              </Button>
            )}
            {(r.scopes.includes('body:read') || r.scopes.includes('body:write')) && (
              <Button asChild variant="secondary">
                <Link to={`/members/${r.member_id}/body`}>体の変化を見る</Link>
              </Button>
            )}
            {r.scopes.includes('body:write') && (
              <Button asChild>
                <Link to={`/members/${r.member_id}/body/new`}>体の測定を代わりに記録する</Link>
              </Button>
            )}
          </div>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => reload()}>
        最新の状態にする
      </Button>
    </div>
  );
}

/** 直近 7 日の記録状況(記号と文字。色だけで区別しない) */
function WeekGrid({ meals, name }: { meals: NonNullable<Row['meals']>; name: string }) {
  const days = [...meals.last_7_days].reverse(); // 古い順に左から
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-center text-base" data-testid="week-grid">
        <caption className="mb-1 text-left text-base">
          {name} さんの直近 7 日の自宅の食事(✓ 記録、ー 食べなかった、デ デイサービス、空白 未記録)
        </caption>
        <thead>
          <tr>
            <th scope="col" className="p-1 text-left">
              区分
            </th>
            {days.map((d) => (
              <th key={d.date} scope="col" className="p-1 font-normal">
                {Number(d.date.slice(8))}日
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(['breakfast', 'lunch', 'dinner'] as const).map((s) => (
            <tr key={s} className="border-t border-line">
              <th scope="row" className="p-1 text-left font-normal">
                {SLOT_LABELS[s].replace('ごはん', '')}
              </th>
              {days.map((d) => {
                const v = d[s];
                return (
                  <td key={d.date} className="p-1" aria-label={v ? undefined : '未記録'}>
                    {v ? SLOT_MARK[v] : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
