import { Link } from 'react-router';
import { SCOPE_LABELS, SCOPE_ORDER } from '@buddyship/shared';
import { useLoader } from '@/lib/useLoader.ts';
import { api } from '@/lib/api.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';

/**
 * 担当利用者の一覧(T-01 の Sprint 1 版)。同意されている項目だけを示す。
 * 食事の記録状況・InBody の列は Sprint 2・3 で、同意がある列だけ追加する。
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
            <ul className="flex flex-col gap-1 text-lg">
              {SCOPE_ORDER.filter((s) => r.scopes.includes(s)).map((s) => (
                <li key={s}>✓ {SCOPE_LABELS[s].label}</li>
              ))}
            </ul>
          )}
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
          </div>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => reload()}>
        最新の状態にする
      </Button>
    </div>
  );
}
