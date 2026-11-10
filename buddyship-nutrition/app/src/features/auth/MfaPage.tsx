import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase.ts';
import { useSession } from '@/lib/session.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Loading } from '@/components/ErrorNotice.tsx';

type State =
  | { kind: 'loading' }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'verify'; factorId: string };

/** スタッフ・管理者の 2 段階認証(TOTP)。登録がなければ登録、あれば確認(SECURITY §2) */
export function MfaPage() {
  const { reload, signOut } = useSession();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // 登録処理は 1 回だけ(開発時の StrictMode で 2 回走ると、表示中の要素が消されることがあるため)
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === 'verified');
      if (verified) {
        setState({ kind: 'verify', factorId: verified.id });
        return;
      }
      // 途中で止まった未確認の登録は消してからやり直す
      for (const f of data?.all ?? []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `端末-${Date.now()}`,
      });
      if (error || !enrolled) {
        setFailed(true);
        return;
      }
      setState({ kind: 'enroll', factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state.kind === 'loading') return;
    setBusy(true);
    setFailed(false);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setFailed(true);
      return;
    }
    await reload();
  }

  if (state.kind === 'loading' && !failed) return <Loading />;

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">2 段階認証</h1>
      {state.kind === 'enroll' && (
        <div className="mb-6">
          <p className="mb-4 text-lg">
            スタッフ用の端末を守るため、認証アプリの登録が必要です。認証アプリで次の QR コードを読み取ってください。
          </p>
          <img src={state.qr} alt="認証アプリ登録用の QR コード" className="mx-auto h-56 w-56 bg-white" />
          <p className="mt-4 text-base">読み取れないときは、次の文字を認証アプリに入力してください。</p>
          <p className="mt-1 break-all rounded-lg bg-surface-muted p-3 font-mono text-lg" data-testid="totp-secret">
            {state.secret}
          </p>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <Label htmlFor="totp">認証アプリに表示された 6 桁の数字</Label>
          <Input
            id="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Button type="submit" disabled={busy || code.length !== 6 || state.kind === 'loading'}>
          確認する
        </Button>
      </form>
      {failed && (
        <p role="alert" className="mt-5 rounded-xl border-2 border-alert p-4 text-lg font-bold text-alert">
          <span aria-hidden="true">⚠ </span>確認できませんでした。新しい数字で、もう一度お試しください。
        </p>
      )}
      <div className="mt-8">
        <Button variant="quiet" onClick={() => void signOut()}>
          ログアウト
        </Button>
      </div>
    </main>
  );
}
