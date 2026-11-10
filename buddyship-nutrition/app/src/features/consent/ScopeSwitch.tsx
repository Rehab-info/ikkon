import { useState } from 'react';
import { SCOPE_LABELS, revokeConfirmMessage, type ConsentScope } from '@buddyship/shared';
import { ConfirmDialog } from '@/components/ui/alert-dialog.tsx';
import { cn } from '@/lib/utils.ts';

/**
 * 1 つのスコープの切り替え(M-13)。オン/オフを文字と記号でも示す(色だけに頼らない)。
 * どちらに変えるときも確認ダイアログを出す(撤回時は「すでに見た内容は取り消せない」ことを伝える)。
 */
export function ScopeSwitch(props: {
  staffName: string;
  scope: ConsentScope;
  granted: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const l = SCOPE_LABELS[props.scope];
  const id = `scope-${props.scope.replace(':', '-')}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-surface-muted py-4 first:border-t-0">
      <div id={`${id}-label`} className="text-lg font-bold">
        {l.label}
        <span className="block text-base font-normal text-ink-muted">({l.note})</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.granted}
        aria-labelledby={`${id}-label`}
        disabled={props.disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-14 min-w-36 items-center justify-center gap-2 rounded-xl border-2 px-4 text-lg font-bold disabled:opacity-60',
          props.granted ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink',
        )}
      >
        <span aria-hidden="true">{props.granted ? '●' : '○'}</span>
        {props.granted ? l.on : l.off}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={
          props.granted
            ? `「${l.label}」をやめますか`
            : `「${l.label}」を${props.staffName}さんに${l.on === '任せる' ? '任せ' : '見せ'}ますか`
        }
        description={
          props.granted
            ? revokeConfirmMessage(props.staffName, props.scope)
            : 'いつでもやめられます。見せなくても、このアプリやデイサービスの利用には影響しません。'
        }
        confirmLabel={props.granted ? 'やめる' : l.on}
        cancelLabel="変えない"
        danger={props.granted}
        onConfirm={() => props.onChange(!props.granted)}
      />
    </div>
  );
}
