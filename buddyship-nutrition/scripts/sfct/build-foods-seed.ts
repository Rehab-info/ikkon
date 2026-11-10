/**
 * 食品マスターのシード SQL を作る(開発・検証用。本番の取込は別途承認のうえで行う)。
 *   node scripts/sfct/build-foods-seed.ts            … supabase/seeds/foods.sql を書く
 *   node scripts/sfct/build-foods-seed.ts --check    … 作り直した結果がコミット済みと同じか確かめる(CI)
 *
 * 入力:packages/nutrition/src/fixtures/sfct8-2023-pfc.json(公式 Excel から SHA-256 照合のうえ取り出したもの)
 *       supabase/seed-data/food-aliases.json(別名辞書)
 * 値の解釈は packages/nutrition の parseSfctValue だけを使う(規則を二重に持たない)。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { FOOD_COMPOSITION_SOURCE, SFCT8_COLUMNS, parseSfctValue } from '../../packages/nutrition/src/index.ts';

const root = new URL('../../', import.meta.url).pathname;
const fixture = JSON.parse(readFileSync(`${root}packages/nutrition/src/fixtures/sfct8-2023-pfc.json`, 'utf8')) as {
  source: { sha256: string };
  foods: { code: string; group: string; name: string; values: Record<string, unknown> }[];
};
const aliases = (
  JSON.parse(readFileSync(`${root}supabase/seed-data/food-aliases.json`, 'utf8')) as {
    aliases: Record<string, string[]>;
  }
).aliases;

if (fixture.source.sha256 !== FOOD_COMPOSITION_SOURCE.fileSha256)
  throw new Error('fixture is not from the recorded official file');

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const num = (v: number | null) => (v === null ? 'null' : String(v));

/** 利用者向けのやさしい名前:分類の記号(＜＞（）［］)を外し、全角空白を半角に */
function displayName(name: string): string {
  return name
    .replace(/＜[^＞]*＞/g, '')
    .replace(/[（(][^）)]*類[）)]/g, '')
    .replace(/[［[]([^］\]]*)[］\]]/g, '$1')
    .replace(/\u3000+/g, ' ')
    .trim();
}

const codes = new Set(fixture.foods.map((f) => f.code));
for (const [alias, list] of Object.entries(aliases)) {
  for (const c of list) if (!codes.has(c)) throw new Error(`alias ${alias}: unknown food code ${c}`);
}

const lines: string[] = [
  '-- 自動生成ファイル(scripts/sfct/build-foods-seed.ts)。手で編集しない',
  `-- 出典:${FOOD_COMPOSITION_SOURCE.citation}(${FOOD_COMPOSITION_SOURCE.errata})`,
  `-- 取込元:${FOOD_COMPOSITION_SOURCE.fileUrl} sha256=${FOOD_COMPOSITION_SOURCE.fileSha256}`,
  'insert into public.foods(source, source_version, source_food_code, food_group, name, display_name,',
  '  energy_kcal, protein_g, fat_g, carbohydrate_g, energy_kind, protein_kind, fat_kind, carbohydrate_kind, raw_values) values',
];
const rows = fixture.foods.map((f) => {
  const get = (n: (typeof SFCT8_COLUMNS)[number]['nutrient']) => {
    const col = SFCT8_COLUMNS.find((c) => c.nutrient === n);
    if (!col) throw new Error(`no column for ${n}`);
    return parseSfctValue(f.values[col.identifier]);
  };
  const raw = Object.fromEntries(SFCT8_COLUMNS.map((c) => [c.identifier, String(f.values[c.identifier])]));
  const e = get('energy_kcal'),
    p = get('protein_g'),
    fa = get('fat_g'),
    ch = get('carbohydrate_g');
  return `(${q(FOOD_COMPOSITION_SOURCE.sourceId)}, ${q(FOOD_COMPOSITION_SOURCE.sourceVersion)}, ${q(f.code)}, ${q(f.group)}, ${q(f.name)}, ${q(displayName(f.name))}, ${num(e.value)}, ${num(p.value)}, ${num(fa.value)}, ${num(ch.value)}, ${q(e.kind)}, ${q(p.kind)}, ${q(fa.kind)}, ${q(ch.kind)}, ${q(JSON.stringify(raw))}::jsonb)`;
});
lines.push(rows.join(',\n') + ';', '');
lines.push('insert into public.food_aliases(food_id, alias)');
lines.push('select f.id, a.alias from (values');
const pairs = Object.entries(aliases).flatMap(([alias, list]) => list.map((c) => `(${q(alias)}, ${q(c)})`));
lines.push(pairs.join(',\n'));
lines.push(
  `) as a(alias, code) join public.foods f on f.source_food_code = a.code and f.source_version = ${q(FOOD_COMPOSITION_SOURCE.sourceVersion)};`,
  '',
);

const out = lines.join('\n');
const target = `${root}supabase/seeds/foods.sql`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== out) {
    console.error('supabase/seeds/foods.sql is out of date. Run: node scripts/sfct/build-foods-seed.ts');
    process.exit(1);
  }
  console.log('foods seed is up to date');
} else {
  writeFileSync(target, out);
  console.log(`wrote ${rows.length} foods and ${pairs.length} aliases`);
}
