import { addDays, formatJaDate, isISODate, lastNDays, toISODate } from "./date";

describe("date", () => {
  it("ローカル日付で YYYY-MM-DD を作る(UTC にずれない)", () => {
    expect(toISODate(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
  it("存在しない日付を弾く", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("26-1-1")).toBe(false);
    expect(isISODate(20260101)).toBe(false);
  });
  it("月・年をまたいで日付を足す", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("直近 n 日を古い順に返す", () => {
    expect(lastNDays(3, "2026-11-08")).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(lastNDays(30, "2026-11-08")).toHaveLength(30);
  });
  it("日本語の日付表記", () => {
    expect(formatJaDate("2026-11-08")).toBe("2026年11月8日(日)");
  });
});
