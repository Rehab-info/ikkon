import { useRef, type KeyboardEvent } from "react";
import { cx } from "./ui";

export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  tabs: readonly { value: T; label: string }[];
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next]!.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className="mb-5 grid rounded-full bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((t, i) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={selected}
            aria-controls={`panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              "min-h-10 rounded-full px-2 text-sm font-medium transition-colors",
              selected ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
