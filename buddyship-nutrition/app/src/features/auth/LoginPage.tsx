import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';

/**
 * ログイン(D-04 仮案:事業所で初期設定を支援し、メールアドレス+パスワード、またはメールで届く 6 桁のコード)。
 * 新規登録はここではできない(招待制)。
 */
export function LoginPage() {
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 失敗の理由(メールアドレスの有無など)は画面に出さない
  const fail = () => setMessage('ログインできませんでした。入力した内容を確かめて、もう一度お試しください。');

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) fail();
  }

  async function onSendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setBusy(false);
    // 登録の有無にかかわらず同じ表示にする
    setCodeSent(true);
  }

  async function onVerifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) fail();
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">食事と体の記録</h1>
      <p className="mb-6 text-lg">ログインしてください。わからないときは、デイサービスのスタッフにお声がけください。</p>

      {mode === 'password' ? (
        <form onSubmit={onPassword} className="flex flex-col gap-5" noValidate>
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy || !email || !password}>
            ログインする
          </Button>
        </form>
      ) : !codeSent ? (
        <form onSubmit={onSendCode} className="flex flex-col gap-5" noValidate>
          <div>
            <Label htmlFor="email-code">メールアドレス</Label>
            <Input
              id="email-code"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy || !email}>
            コードをメールで受け取る
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerifyCode} className="flex flex-col gap-5" noValidate>
          <p className="text-lg" role="status">
            登録されているメールアドレスなら、6 桁のコードを送りました。
          </p>
          <div>
            <Label htmlFor="otp">メールに書かれた 6 桁のコード</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          <Button type="submit" disabled={busy || code.length !== 6}>
            ログインする
          </Button>
        </form>
      )}

      {message && (
        <p role="alert" className="mt-5 rounded-xl border-2 border-alert p-4 text-lg font-bold text-alert">
          <span aria-hidden="true">⚠ </span>
          {message}
        </p>
      )}

      <div className="mt-8">
        <Button
          variant="quiet"
          onClick={() => {
            setMode(mode === 'password' ? 'code' : 'password');
            setCodeSent(false);
            setMessage(null);
          }}
        >
          {mode === 'password' ? 'パスワードの代わりにメールのコードで入る' : 'パスワードで入る'}
        </Button>
      </div>
    </main>
  );
}
