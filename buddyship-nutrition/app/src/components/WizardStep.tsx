import type { ReactNode } from 'react';
import { Button } from './ui/button.tsx';

/**
 * 1 画面 1 つの質問(ウィザード形式。SCREENS §1)。
 * 主ボタンは画面下部に固定し、「戻る」で前の質問に戻れる。
 */
export function WizardStep(props: {
  step?: { current: number; total: number };
  title: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col">
      {props.step && (
        <p className="mb-2 text-base font-bold text-ink-muted">
          {props.step.total} のうち {props.step.current} 番目
        </p>
      )}
      <h1 className="mb-5 text-2xl font-bold">{props.title}</h1>
      <div className="flex-1">{props.children}</div>
      <div className="sticky bottom-0 mt-6 flex flex-col gap-3 bg-surface py-4">
        <Button onClick={props.onPrimary} disabled={props.primaryDisabled}>
          {props.primaryLabel}
        </Button>
        {props.onBack && (
          <Button variant="quiet" onClick={props.onBack}>
            戻る
          </Button>
        )}
      </div>
    </div>
  );
}
