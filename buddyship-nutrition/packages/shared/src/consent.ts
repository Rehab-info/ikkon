import type { ConsentScope } from './schemas.ts';

/**
 * 同意スコープの表示。画面では平易な言葉を使い、正式な語は説明に併記する(SCREENS M-13)。
 * 代理入力(write)は閲覧(read)とは別に、データ種別ごとに明示的に同意を得る。
 */
export const SCOPE_ORDER: readonly ConsentScope[] = ['meals:read', 'meals:write', 'body:read', 'body:write'];

export const SCOPE_LABELS: Record<ConsentScope, { label: string; on: string; off: string; note: string }> = {
  'meals:read': { label: '食事の記録を見る', on: '見せる', off: '見せない', note: '食事記録の閲覧' },
  'meals:write': { label: '食事を代わりに記録する', on: '任せる', off: '任せない', note: '食事の代理入力' },
  'body:read': { label: '体の測定を見る', on: '見せる', off: '見せない', note: 'InBody 記録の閲覧' },
  'body:write': { label: '体の測定を代わりに記録する', on: '任せる', off: '任せない', note: 'InBody の代理入力' },
};

/** 撤回するときの確認文 */
export function revokeConfirmMessage(staffName: string, scope: ConsentScope): string {
  const what = SCOPE_LABELS[scope].label.replace(/する$/, '');
  return `${staffName}さんは、これから「${what}」ことができなくなります。すでに見た内容は取り消せません。`;
}
