import type { AppRole, MyContext } from '@buddyship/shared';

export type Gate =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'not_registered' }
  | { kind: 'mfa' }
  | { kind: 'onboarding' }
  | { kind: 'ready'; home: '/' | '/staff' | '/admin'; roles: AppRole[] };

/**
 * ログイン後にどの画面へ進むかを決める(画面の出し分けは利便性のため。認可は DB 側で判定する)。
 *  - スタッフ・管理者は MFA(aal2)が済むまで先に進めない
 *  - 未同意の文書があれば先に同意画面
 */
export function decideGate(input: { loading: boolean; signedIn: boolean; context: MyContext | null }): Gate {
  if (input.loading) return { kind: 'loading' };
  if (!input.signedIn) return { kind: 'login' };
  const ctx = input.context;
  if (!ctx) return { kind: 'loading' };
  if (!ctx.registered) return { kind: 'not_registered' };
  if (ctx.roles.length === 0) return { kind: 'not_registered' };
  const privileged = ctx.roles.includes('staff') || ctx.roles.includes('admin');
  if (privileged && ctx.aal !== 'aal2') return { kind: 'mfa' };
  if (ctx.pending_documents.length > 0) return { kind: 'onboarding' };
  const home = ctx.roles.includes('member') ? '/' : ctx.roles.includes('staff') ? '/staff' : '/admin';
  return { kind: 'ready', home, roles: ctx.roles };
}
