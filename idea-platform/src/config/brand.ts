/**
 * サービス名・ロゴの表記をここに集約しています。
 * 表記を変更する場合はこのファイルだけを編集してください。
 */
export const BRAND = {
  /** サービス名 */
  name: 'MIND BUY',
  /** 短い補足（ヘッダーのロゴ横などで使用） */
  shortTagline: 'アイデアと人が出会う知識のマーケットプレイス',
  /** フッターの著作表示 */
  copyrightHolder: 'MIND BUY',
  /** IndexedDB のデータベース名（名称変更してもデータを引き継ぐ場合は変更しない） */
  databaseName: 'idea-platform-demo',
  /** バックアップJSONの識別子 */
  backupAppId: 'idea-platform-prototype',
} as const

/** ロゴの頭文字。ロゴ確定時は Header の Logo コンポーネントを差し替える */
export const BRAND_MARK = 'MB'
