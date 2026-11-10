import { useCallback } from 'react';
import { useParams } from 'react-router';
import { useSession } from '@/lib/session.tsx';
import { api } from '@/lib/api.ts';
import { useLoader } from '@/lib/useLoader.ts';
import type { ConsentScope } from '@buddyship/shared';

export interface MemberTarget {
  memberId: string;
  /** 本人の画面か(false ならスタッフが担当利用者を見ている) */
  self: boolean;
  name: string;
  scopes: ConsentScope[];
}

/** 画面の対象の利用者。本人なら自分、スタッフなら URL の memberId(担当一覧で同意の範囲を確かめる) */
export function useMemberTarget(): { target: MemberTarget | null; error: unknown } {
  const { memberId } = useParams();
  const { context } = useSession();
  const me = context?.registered ? context : null;
  const load = useCallback(async (): Promise<MemberTarget | null> => {
    if (!me) return null;
    if (!memberId || memberId === me.user_id) {
      return { memberId: me.user_id, self: true, name: me.display_name, scopes: ['meals:read', 'meals:write'] };
    }
    const rows = await api.staffDashboard();
    const row = rows.find((r) => r.member_id === memberId);
    if (!row) return null;
    return { memberId: row.member_id, self: false, name: row.display_name, scopes: row.scopes };
  }, [me, memberId]);
  const { data, error } = useLoader(load);
  return { target: data, error };
}
