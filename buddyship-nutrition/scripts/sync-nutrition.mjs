#!/usr/bin/env node
/**
 * packages/nutrition/src を supabase/functions/_shared/nutrition にコピーする。
 * Edge Functions の実行環境は supabase/functions の外を読めないため、規則の唯一の定義(packages/nutrition)を写す。
 *   node scripts/sync-nutrition.mjs          … コピーする
 *   node scripts/sync-nutrition.mjs --check  … コピーが最新か確かめる(CI。手で直接編集させない)
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'packages/nutrition/src');
const dst = join(root, 'supabase/functions/_shared/nutrition');
const HEADER = '// 自動生成(scripts/sync-nutrition.mjs)。packages/nutrition/src から写したもの。ここを直接編集しない\n';
const files = readdirSync(src).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
const expected = Object.fromEntries(files.map((f) => [f, HEADER + readFileSync(join(src, f), 'utf8')]));

if (process.argv.includes('--check')) {
  const actual = existsSync(dst) ? readdirSync(dst).filter((f) => f.endsWith('.ts')) : [];
  const ok =
    actual.length === files.length &&
    files.every((f) => existsSync(join(dst, f)) && readFileSync(join(dst, f), 'utf8') === expected[f]);
  if (!ok) {
    console.error('supabase/functions/_shared/nutrition is out of date. Run: node scripts/sync-nutrition.mjs');
    process.exit(1);
  }
  console.log('nutrition copy is up to date');
} else {
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  for (const [f, text] of Object.entries(expected)) writeFileSync(join(dst, f), text);
  console.log(`copied ${files.length} files`);
}
