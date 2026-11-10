import { useState } from 'react';
import { useSession } from '@/lib/session.tsx';
import { api } from '@/lib/api.ts';
import { WizardStep } from '@/components/WizardStep.tsx';
import { ErrorNotice } from '@/components/ErrorNotice.tsx';
import { Button } from '@/components/ui/button.tsx';

/** はじめての説明と同意(S-03)。文書を 1 つずつ読み、すべてに同意したら使い始められる */
export function OnboardingPage() {
  const { context, reload, signOut } = useSession();
  const docs = context?.registered ? context.pending_documents : [];
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const doc = docs[index];
  if (!doc) return null;
  const last = index === docs.length - 1;

  async function next() {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    try {
      await api.acceptDocuments(docs.map((d) => d.id));
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <WizardStep
        step={{ current: index + 1, total: docs.length }}
        title={doc.title}
        primaryLabel={last ? 'すべてに同意して始める' : '同意して次へ'}
        onPrimary={() => void next()}
        primaryDisabled={busy}
        {...(index > 0 ? { onBack: () => setIndex(index - 1) } : {})}
      >
        <div className="whitespace-pre-wrap rounded-xl bg-surface-muted p-4 text-lg" tabIndex={0} aria-label="説明文">
          {doc.body}
        </div>
        <p className="mt-3 text-base text-ink-muted">版:{doc.version}</p>
        <ErrorNotice error={error} />
      </WizardStep>
      <Button variant="quiet" onClick={() => void signOut()}>
        同意しないでログアウトする
      </Button>
    </main>
  );
}
