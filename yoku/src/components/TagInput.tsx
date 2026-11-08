import { useId, useState } from "react";
import { X } from "lucide-react";
import { LIMITS } from "../lib/validate";

export function TagInput({ value, onChange, label = "タグ" }: { value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/^#/, "").slice(0, LIMITS.tag);
    if (t && !value.includes(t) && value.length < LIMITS.tags) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        <span className="text-xs font-normal text-muted">任意・{LIMITS.tags}個まで</span>
      </label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="追加したタグ">
          {value.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-sm text-ink">
              #{t}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-line"
                aria-label={`タグ「${t}」を外す`}
              >
                <X aria-hidden size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          maxLength={LIMITS.tag}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          placeholder="例:ゆっくり"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          autoComplete="off"
        />
        <button type="button" onClick={add} className="min-h-12 shrink-0 rounded-xl border border-line px-4 text-sm font-medium text-primary hover:bg-surface-2">
          追加
        </button>
      </div>
    </div>
  );
}
