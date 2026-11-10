import { FOOD_COMPOSITION_SOURCE, sourceNotice } from '@buddyship/nutrition';
import { Card, CardTitle } from './ui/card.tsx';

/**
 * このアプリの目的と限界(安全要件 1〜4・6・7)。設定画面に常に出す。
 */
export function AboutApp() {
  return (
    <Card aria-labelledby="about-title">
      <CardTitle id="about-title">このアプリについて</CardTitle>
      <ul className="flex list-disc flex-col gap-2 pl-6 text-lg">
        <li>ご自宅で食べた食事の記録と、栄養のおおよその量の推定、体の測定の変化を見るためのものです。</li>
        <li>病気や体の状態(低栄養やサルコペニアなど)を判断することはしません。</li>
        <li>食べる量の目標や、食事の制限を決めることはしません。治療のための食事の指導もしません。</li>
        <li>栄養の値は推定で、実際とは差があります。気になることは、かかりつけの医師などにご相談ください。</li>
      </ul>
      <p className="mt-4 text-base text-ink-muted" data-testid="source-notice">
        {sourceNotice()}
      </p>
      <p className="mt-1 text-base text-ink-muted">提供:{FOOD_COMPOSITION_SOURCE.publisher}</p>
    </Card>
  );
}
