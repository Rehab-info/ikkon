import type { Idea, IdeaPreview, User } from '../types'

/**
 * 購入前に公開してよい項目だけを取り出す。
 * 一覧・カード・購入前の詳細画面には、必ずこの関数を通した値を渡す。
 */
export function toPublicPreview(idea: Idea): IdeaPreview {
  return {
    id: idea.id,
    creatorId: idea.creatorId,
    title: idea.title,
    catchcopy: idea.catchcopy,
    category: idea.category,
    tags: idea.tags,
    targetCustomers: idea.targetCustomers,
    price: idea.price,
    status: idea.status,
    featuredScore: idea.featuredScore,
    publishedAt: idea.publishedAt,
    updatedAt: idea.updatedAt,
    validationStage: idea.validation.stage,
    deliverableNames: idea.deliverables.map((d) => d.name),
  }
}

/**
 * 詳細（概要・課題・差異・検証内容・知識マップ）を表示できるか。
 * 購入デモを実行した利用者、創作者本人、運営（デモ）のみ。
 * ※ プロトタイプではブラウザ内に全データがあるため、表示の出し分けに留まる。
 *   本番ではサーバー側で購入済みの利用者にだけ詳細を返す必要がある。
 */
export function canViewFullIdea(idea: Pick<Idea, 'creatorId'>, user: Pick<User, 'role' | 'creatorId'>, hasPurchased: boolean): boolean {
  if (hasPurchased) return true
  if (user.role === 'admin') return true
  return Boolean(user.creatorId && user.creatorId === idea.creatorId)
}
