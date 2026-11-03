import { IDEA_STATUS_META } from '../../lib/labels'
import type { IdeaStatus } from '../../types'
import { Badge } from '../ui/Badge'

export function IdeaStatusBadge({ status }: { status: IdeaStatus }) {
  const meta = IDEA_STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}
