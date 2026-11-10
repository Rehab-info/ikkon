import { useState } from 'react';
import { SCOPE_ORDER, type ConsentScope } from '@buddyship/shared';
import { useLoader } from '@/lib/useLoader.ts';
import { api } from '@/lib/api.ts';
import { Card, CardTitle } from '@/components/ui/card.tsx';
import { ErrorNotice, Loading } from '@/components/ErrorNotice.tsx';
import { ScopeSwitch } from './ScopeSwitch.tsx';

async function loadConsentPage() {
  const [staff, doc] = await Promise.all([api.listMyStaff(), api.staffSharingDocument()]);
  return { staff, doc };
}

/** 担当スタッフに見せる情報(M-13)。スタッフごと・データ種別ごとに、見る/代わりに記録するを選ぶ */
export function ConsentPage() {
  const { data, error: loadError, reload } = useLoader(loadConsentPage);
  const staff = data?.staff ?? null;
  const doc = data?.doc ?? null;
  const [actionError, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const error = actionError ?? loadError;

  async function change(staffId: string, scope: ConsentScope, next: boolean) {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      if (next) await api.grantConsent(staffId, scope, doc.id);
      else await api.revokeConsent(staffId, scope);
      reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!staff && !error) return <Loading />;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">担当スタッフに見せる情報</h1>
      <p className="rounded-xl bg-surface-muted p-4 text-lg">
        見せるかどうかは、項目ごとにいつでも変えられます。見せなくても、このアプリやデイサービスの利用には影響しません。
      </p>
      {doc && (
        <details className="rounded-xl border-2 border-line p-4">
          <summary className="cursor-pointer text-lg font-bold">{doc.title}(くわしい説明)</summary>
          <p className="mt-3 whitespace-pre-wrap text-lg">{doc.body}</p>
        </details>
      )}
      <ErrorNotice error={error} />
      {staff?.length === 0 && <p className="text-lg">担当のスタッフはまだ決まっていません。</p>}
      {staff?.map((s) => (
        <Card key={s.staff_id} aria-labelledby={`staff-${s.staff_id}`}>
          <CardTitle id={`staff-${s.staff_id}`}>担当:{s.display_name} さん</CardTitle>
          {SCOPE_ORDER.map((scope) => (
            <ScopeSwitch
              key={scope}
              staffName={s.display_name}
              scope={scope}
              granted={s.scopes.includes(scope)}
              disabled={busy}
              onChange={(next) => void change(s.staff_id, scope, next)}
            />
          ))}
        </Card>
      ))}
    </div>
  );
}
