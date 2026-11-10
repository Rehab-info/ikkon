// 自動生成(scripts/sync-nutrition.mjs)。packages/nutrition/src から写したもの。ここを直接編集しない
/**
 * 食品成分表の出典と版(安全要件 7:画面に出典とバージョンを表示する)。
 * 新しい増補・正誤表を取り込んだらここを更新し、RULES_VERSION も上げる。
 */
export const FOOD_COMPOSITION_SOURCE = {
  /** 食品成分表の名称(版) */
  title: '日本食品標準成分表(八訂)増補2023年',
  /** 反映済みの正誤表 */
  errata: '2026年3月27日 正誤表 反映済み',
  /** 文部科学省の案内による出典表記 */
  citation: '日本食品標準成分表(八訂)増補2023年から引用',
  publisher: '文部科学省',
  pageUrl: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html',
  fileUrl: 'https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx',
  fileSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c',
  /** DB の foods.source / source_version に入れる値 */
  sourceId: 'mext_sfct8',
  sourceVersion: '2023-supplement+errata-2026-03-27',
} as const;

/** 画面に出す出典・版の 1 行表示 */
export function sourceNotice(): string {
  const s = FOOD_COMPOSITION_SOURCE;
  return `栄養の値は「${s.title}」(${s.publisher}、${s.errata})から計算した推定値です。出典:${s.citation}`;
}
