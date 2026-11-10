import { AppError, ERROR_MESSAGES } from '@buddyship/shared';

/** エラー表示。色だけに頼らず記号と文で伝え、読み上げにも通知する */
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof AppError ? error.message : ERROR_MESSAGES.internal;
  return (
    <p role="alert" className="my-4 rounded-xl border-2 border-alert bg-surface p-4 text-lg font-bold text-alert">
      <span aria-hidden="true">⚠ </span>
      {message}
    </p>
  );
}

export function Loading({ label = '読み込んでいます' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="py-10 text-center text-lg">
      {label}…
    </p>
  );
}
