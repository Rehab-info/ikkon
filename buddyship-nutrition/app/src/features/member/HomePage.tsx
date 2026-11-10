import { Link } from 'react-router';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardTitle } from '@/components/ui/card.tsx';

/** 本人のホーム(M-01)。食事・体の記録は Sprint 2・3 で追加する */
export function HomePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">ホーム</h1>
      <Card>
        <CardTitle>食事と体の記録</CardTitle>
        <p className="text-lg">ご自宅で食べた食事と、体の測定を記録できるようになります(準備中)。</p>
      </Card>
      <Button asChild variant="secondary">
        <Link to="/sharing">担当スタッフに見せる情報を決める</Link>
      </Button>
    </div>
  );
}
