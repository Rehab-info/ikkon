/**
 * サービス名・ロゴは未確定のため、仮称をここに集約しています。
 * 名称を変更する場合はこのファイルだけを編集してください。
 */
export const BRAND = {
  /** サービス名（仮称） */
  name: 'IDEA PLATFORM',
  /** 短い補足（ヘッダーのロゴ横などで使用） */
  shortTagline: 'アイデアと人が出会う知識のマーケットプレイス',
  /** フッターの著作表示 */
  copyrightHolder: 'IDEA PLATFORM（仮称）',
  /** IndexedDB のデータベース名（名称変更してもデータを引き継ぐ場合は変更しない） */
  databaseName: 'idea-platform-demo',
  /** バックアップJSONの識別子 */
  backupAppId: 'idea-platform-prototype',
} as const

/** ロゴの頭文字（仮）。ロゴ確定時は Header の Logo コンポーネントを差し替える */
export const BRAND_MARK = 'IP'
