import { BRAND } from '../config/brand'
import { IIP_SECTION_KEYS, type IdeaPackage } from '../types'
import { IIP_SECTION_META } from './labels'

/** HTML特殊文字のエスケープ（ユーザー入力をそのままHTMLに入れない） */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphs(text: string): string {
  const body = text.trim()
  if (!body) return '<p class="empty">（未記入）</p>'
  return body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** IIP を単独で閲覧・印刷できる HTML 文書に変換する */
export function buildIipHtml(pkg: IdeaPackage, authorName: string): string {
  const sections = IIP_SECTION_KEYS.map(
    (key) => `<section><h2>${escapeHtml(IIP_SECTION_META[key].label)}</h2>${paragraphs(pkg.sections[key])}</section>`,
  ).join('\n')
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(pkg.title || 'IIP')} | IIP</title>
<style>
body{font-family:'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif;color:#2e3238;line-height:1.8;max-width:760px;margin:40px auto;padding:0 20px}
h1{color:#14213d;font-size:26px;line-height:1.4;margin:8px 0}
h2{color:#14213d;font-size:17px;border-top:1px solid #e4e6ea;padding-top:20px;margin-top:28px}
.meta{color:#5f6670;font-size:13px}.eyebrow{color:#8a6a2f;font-size:12px;letter-spacing:.15em}
.lead{font-size:16px;color:#5f6670}.empty{color:#9aa1ab}
.note{margin-top:40px;font-size:12px;color:#5f6670;border:1px solid #e4e6ea;padding:12px}
</style>
</head>
<body>
<p class="eyebrow">IIP — アイデア情報パッケージ</p>
<h1>${escapeHtml(pkg.title || '（無題）')}</h1>
<p class="lead">${escapeHtml(pkg.catchcopy)}</p>
<p class="meta">カテゴリー：${escapeHtml(pkg.category)}／作成者：${escapeHtml(authorName)}</p>
<section><h2>想定顧客</h2>${paragraphs(pkg.targetCustomers)}</section>
${sections}
<p class="note">この文書は ${escapeHtml(BRAND.name)} のプロトタイプで作成されました。記載の数値・調査結果は作成者による仮説を含みます。特許権などの権利を示すものではありません。</p>
</body>
</html>`
}
