/**
 * 画面の文言の安全確認(安全要件 2〜6)。
 * 診断・目標量・食事制限・治療的な指導・「1 日の総摂取量」に当たる表現が、画面のコードと共有モジュールに入っていないことを機械的に確かめる。
 * 「〜しません」という否定の説明文は許す。新しい画面を追加したら自動で対象になる。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['..', '../../packages/shared/src', '../../packages/nutrition/src'].map(
  (p) => new URL(p, import.meta.url).pathname,
);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'fixtures' || name === 'node_modules' ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

// 断定・指示に当たる言い回し(否定文「〜しません」は対象外)
const BANNED: [RegExp, string][] = [
  [
    /(低栄養|サルコペニア|フレイル|糖尿病|腎臓病)(です|の(疑い|おそれ|可能性|リスク)|と(判定|診断))/,
    '疾患・状態の判定',
  ],
  [/(不足|過剰|摂りすぎ|とりすぎ)(しています|です|気味)/, '栄養の過不足の判定'],
  [/(目標|推奨)(摂取)?量(は|を|:)/, '個人別の目標量'],
  [/(を)?(控え|減ら|増や|制限し)ましょう/, '食事の指示'],
  [/食事制限(を|が)(設定|必要)/, '食事制限の設定'],
  [/1\s*日の(総摂取量|合計)|一日の(総摂取量|合計)/, '1 日の総摂取量の表示'],
];

describe('画面の文言(安全要件)', () => {
  const all = ROOTS.flatMap(files);

  it('対象ファイルがある', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it.each(BANNED)('%s(%s)に当たる表現がない', (re) => {
    const hits = all.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ f, i: i + 1, line }))
        // コメント(規則の説明)は対象外。画面に出る文字列とコードだけを見る
        .filter(({ line }) => !/^\s*(\/\/|\/\*|\*)/.test(line) && re.test(line)),
    );
    expect(hits.map((h) => `${h.f}:${h.i}: ${h.line.trim()}`)).toEqual([]);
  });
});
