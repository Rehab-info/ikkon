import { buildTrend, summarize } from "./trend";
import type { WellnessEntry } from "../../db/types";

const e = (date: string, extra: Partial<WellnessEntry>): WellnessEntry => ({ id: date, date, createdAt: "", updatedAt: "", ...extra });

describe("trend", () => {
  it("未回答の日は null、0 は 0 のまま", () => {
    const pts = buildTrend([e("2026-11-06", { mood: 0 }), e("2026-11-08", { mood: 7 })], "mood", 3, "2026-11-08");
    expect(pts).toEqual([
      { date: "2026-11-06", value: 0 },
      { date: "2026-11-07", value: null },
      { date: "2026-11-08", value: 7 }
    ]);
    expect(summarize(pts)).toMatchObject({ answered: 2, missing: 1, avg: 3.5, min: 0, max: 7 });
  });
  it("記録がなければ平均を出さない", () => {
    expect(summarize(buildTrend([], "stress", 7, "2026-11-08"))).toMatchObject({ answered: 0, missing: 7, avg: null });
  });
  it("項目ごとに独立(他の項目の値は混ざらない)", () => {
    const pts = buildTrend([e("2026-11-08", { appetite: 9 })], "sexualDesire", 1, "2026-11-08");
    expect(pts[0]!.value).toBeNull();
  });
});
