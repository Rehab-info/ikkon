/**
 * 仮公開用のプレビュービルド(VITE_PREVIEW=1)。
 * 表示先の枠では Service Worker・共有シート・ファイルのダウンロードが使えないため、その機能を止める。
 * 通常のビルドとテストでは false。
 */
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === "1";
