import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useThemeColors } from "../../lib/useThemeColors";
import { formatShortDate } from "../../lib/date";
import { summarize, type TrendPoint } from "./trend";

export function TrendChart({ points, label, unit = "", max = 10 }: { points: TrendPoint[]; label: string; unit?: string; max?: number }) {
  const c = useThemeColors();
  const [showTable, setShowTable] = useState(false);
  const s = summarize(points);
  const summary =
    s.answered === 0
      ? `${label}:この期間の記録はありません`
      : `${label}:${points.length}日中${s.answered}日回答。平均${s.avg}${unit}、最小${s.min}${unit}、最大${s.max}${unit}`;
  return (
    <div>
      <div role="img" aria-label={summary} className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: c.muted, fontSize: 11 }}
              stroke={c.line}
              minTickGap={18}
            />
            <YAxis domain={[0, max]} allowDecimals={false} tick={{ fill: c.muted, fontSize: 11 }} stroke={c.line} width={48} />
            <Tooltip
              formatter={(v) => [`${String(v)}${unit}`, label]}
              labelFormatter={(d) => formatShortDate(String(d))}
              contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, color: c.text, fontSize: 12 }}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={c.primary}
              strokeWidth={2.25}
              dot={{ r: 2.5, fill: c.primary, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          回答 {s.answered}日 / 未回答 {s.missing}日{s.avg !== null && ` ・ 平均 ${s.avg}${unit}`}
        </span>
        <button type="button" className="min-h-8 underline underline-offset-2" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? "表を閉じる" : "表で見る"}
        </button>
      </div>
      {showTable && (
        <table className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{label}の推移</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 font-medium">日付</th>
              <th scope="col" className="py-1 font-medium">{label}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date} className="border-t border-line">
                <td className="py-1">{formatShortDate(p.date)}</td>
                <td className="py-1 tabular-nums">{p.value === null ? "未回答" : `${p.value}${unit}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
