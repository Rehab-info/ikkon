import { useSession } from '@/lib/session.tsx';
import { Button } from '@/components/ui/button.tsx';

export function NotRegisteredPage() {
  const { signOut } = useSession();
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">まだ使えません</h1>
      <p className="mb-6 text-lg">アカウントの準備ができていません。デイサービスのスタッフにお問い合わせください。</p>
      <Button variant="quiet" onClick={() => void signOut()}>
        ログアウト
      </Button>
    </main>
  );
}
