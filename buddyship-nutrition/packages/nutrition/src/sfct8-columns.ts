/**
 * 公式 Excel(第2章データ、シート「表全体」)の列と、アプリで使う 4 成分の対応(D-18 ②)。
 * 管理栄養士が常勤しない前提のため、成分表の「標準的な成分値」を使う。
 *
 *   エネルギー:ENERC_KCAL(kcal。成分表の公表値をそのまま使い、P/F/C から再計算しない)
 *   たんぱく質:PROT-(たんぱく質。アミノ酸組成による PROTCAA は使わない)
 *   脂質    :FAT-(脂質。トリアシルグリセロール当量 FATNLEA は使わない)
 *   炭水化物 :CHOCDF-(炭水化物。利用可能炭水化物 CHOAVL 等は使わない)
 *
 * 注:指示書の「ENERC(kcal)」「CHOCDF」は、公式 Excel ではそれぞれ ENERC_KCAL、CHOCDF-(末尾にハイフン)。
 *     ENERC は kJ の列なので使わない。
 */
export type Nutrient = 'energy_kcal' | 'protein_g' | 'fat_g' | 'carbohydrate_g';

export interface ColumnSpec {
  nutrient: Nutrient;
  /** 成分識別子(12 行目) */
  identifier: string;
  /** Excel の列 */
  column: string;
  /** 見出しの成分名(3 行目、結合セル) */
  label: string;
  /** 単位 */
  unit: 'kcal' | 'g';
  /** 表示名 */
  displayName: string;
}

export const SFCT8_LAYOUT = {
  sheet: '表全体',
  unitRow: 11,
  identifierRow: 12,
  firstDataRow: 13,
  foodCodeColumn: 'B',
  foodNameColumn: 'D',
  expectedFoodCount: 2538,
} as const;

export const SFCT8_COLUMNS: readonly ColumnSpec[] = [
  {
    nutrient: 'energy_kcal',
    identifier: 'ENERC_KCAL',
    column: 'G',
    label: 'エネルギー',
    unit: 'kcal',
    displayName: 'エネルギー',
  },
  {
    nutrient: 'protein_g',
    identifier: 'PROT-',
    column: 'J',
    label: 'たんぱく質',
    unit: 'g',
    displayName: 'たんぱく質',
  },
  { nutrient: 'fat_g', identifier: 'FAT-', column: 'M', label: '脂質', unit: 'g', displayName: '脂質' },
  {
    nutrient: 'carbohydrate_g',
    identifier: 'CHOCDF-',
    column: 'U',
    label: '炭水化物',
    unit: 'g',
    displayName: '炭水化物',
  },
];

/** 取り違えやすい近い列(使わない)。テストで「選んでいないこと」を確かめる */
export const SFCT8_NOT_USED = ['ENERC', 'PROTCAA', 'FATNLEA', 'CHOAVL', 'CHOAVLM', 'CHOAVLDF-'] as const;
