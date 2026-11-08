import { SCORE_META, type ScoreMeta } from "../../lib/labels";
import type { Settings } from "../../db/types";

export function visibleScoreMeta(settings: Pick<Settings, "showSexualDesire">): ScoreMeta[] {
  return SCORE_META.filter((m) => m.key !== "sexualDesire" || settings.showSexualDesire);
}
