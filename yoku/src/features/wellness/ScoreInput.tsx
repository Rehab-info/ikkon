import { useId } from "react";
import { cx } from "../../components/ui";

/**
 * 0〜10 の主観評価。何も選ばない状態を「未回答」とし、0 と区別する。
 * スライダーにしないのは、初期位置(例:5)が回答を誘導しないようにするため。
 */
export function ScoreInput({
  label,
  low,
  high,
  value,
  onChange,
  hint,
  guide
}: {
  label: string;
  low: string;
  high: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint?: string;
  guide?: readonly { score: number; text: string }[];
}) {
  const name = useId();
  return (
    <fieldset className="mb-5">
      <legend className="sr-only">{label}</legend>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span aria-hidden className="text-[0.95rem] font-medium text-ink">
          {label}
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span className={cx("tabular-nums", value === undefined ? "text-muted" : "font-semibold text-primary")} aria-hidden>
            {value === undefined ? "未回答" : value}
          </span>
          {value !== undefined && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="min-h-8 rounded-full px-2 text-xs text-muted underline underline-offset-2 hover:text-ink"
              aria-label={`${label}を未回答に戻す`}
            >
              クリア
            </button>
          )}
        </span>
      </div>
      {hint && <p className="mb-2 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="grid grid-cols-11 gap-1" role="presentation">
        {Array.from({ length: 11 }, (_, n) => {
          const checked = value === n;
          return (
            <label
              key={n}
              className={cx(
                "flex h-10 cursor-pointer items-center justify-center rounded-lg text-sm tabular-nums transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary",
                checked ? "bg-primary font-semibold text-on-primary" : "bg-surface-2 text-ink hover:bg-primary-soft"
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={n}
                checked={checked}
                onChange={() => onChange(n)}
                aria-label={`${n}${n === 0 ? `(${low})` : n === 10 ? `(${high})` : ""}`}
              />
              {n}
            </label>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.7rem] text-muted" aria-hidden>
        <span>0 {low}</span>
        <span>{high} 10</span>
      </div>
      {guide && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed">
          {guide.map((g) => (
            <div key={g.score} className="contents">
              <dt className={cx("text-right font-semibold tabular-nums", value === g.score ? "text-primary" : "text-ink")}>{g.score}</dt>
              <dd className={value === g.score ? "font-medium text-ink" : "text-muted"}>{g.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </fieldset>
  );
}
