import { AlertDialog as P } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from './button.tsx';

/**
 * 確認ダイアログ(取り消せない操作の前に必ず出す。SCREENS §1)
 * ボタンは「やめる」を先に置き、誤って実行しにくくする
 */
export function ConfirmDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <P.Root open={props.open} onOpenChange={props.onOpenChange}>
      <P.Portal>
        <P.Overlay className="fixed inset-0 bg-black/60" />
        <P.Content className="fixed inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-xl">
          <P.Title className="mb-3 text-xl font-bold">{props.title}</P.Title>
          <P.Description className="mb-6 text-lg">{props.description}</P.Description>
          <div className="flex flex-col gap-3">
            <P.Cancel asChild>
              <Button variant="quiet">{props.cancelLabel ?? 'やめる'}</Button>
            </P.Cancel>
            <P.Action asChild>
              <Button variant={props.danger ? 'danger' : 'primary'} onClick={props.onConfirm}>
                {props.confirmLabel}
              </Button>
            </P.Action>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
