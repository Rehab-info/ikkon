import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode
} from "react";
import { ChevronLeft, Eye, X } from "lucide-react";
import { goBack } from "../lib/router";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------------- Layout ---------------- */

export function Page({
  title,
  subtitle,
  back,
  actions,
  children,
  eyebrow
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // 画面が切り替わったら見出しにフォーカスを移し、スクリーンリーダーに伝える
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [title]);
  return (
    <div className="fade-in mx-auto w-full max-w-xl px-4 pb-28 pt-4">
      <header className="mb-5 flex items-start gap-2">
        {back && (
          <button
            type="button"
            onClick={() => goBack(back)}
            className="-ml-2 mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
            aria-label="戻る"
          >
            <ChevronLeft aria-hidden size={24} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">{eyebrow}</p>}
          <h1 ref={headingRef} tabIndex={-1} className="text-[1.375rem] font-semibold leading-snug text-ink outline-none">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
  description
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={cx("mb-7", className)}>
      {title && (
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <div>
            <h2 id={id} className="text-[0.95rem] font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({
  children,
  className,
  as: As = "div",
  padded = true
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
  padded?: boolean;
}) {
  return (
    <As className={cx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", padded && "p-4", className)}>
      {children}
    </As>
  );
}

/* ---------------- Buttons ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-strong",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  soft: "bg-primary-soft text-primary-strong hover:brightness-95",
  ghost: "text-primary hover:bg-primary-soft",
  danger: "bg-danger text-white hover:brightness-110 dark:text-[#2a1110]"
};

export function buttonClass(variant: Variant = "primary", full = false, size: "md" | "sm" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" ? "min-h-12 px-5 text-[0.95rem]" : "min-h-10 px-3.5 text-sm",
    variants[variant],
    full && "w-full"
  );
}

export function Button({
  variant = "primary",
  full,
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean; size?: "md" | "sm" }) {
  return <button type={type} className={cx(buttonClass(variant, full, size), className)} {...rest} />;
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Form fields ---------------- */

const fieldBase =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  children
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-muted">任意</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  type = "text",
  maxLength,
  placeholder,
  inputMode,
  autoFocus,
  list
}: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "number" | "search";
  maxLength?: number;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text" | "search";
  autoFocus?: boolean;
  list?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        className={fieldBase}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        autoComplete="off"
        list={list}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  rows = 3,
  maxLength = 2000,
  placeholder
}: FieldProps & { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; placeholder?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        className={cx(fieldBase, "resize-y leading-relaxed")}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />
    </FieldShell>
  );
}

export function Select<T extends string>({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  options
}: FieldProps & { value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[] }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        className={cx(fieldBase, "appearance-none")}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-describedby={describedBy(id, hint, error)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** ラジオボタンを丸いチップとして並べる */
export function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  tone = "primary"
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  error?: string;
  hint?: string;
  tone?: "primary" | "accent";
}) {
  const name = useId();
  return (
    <fieldset className="mb-4" aria-describedby={error ? `${name}-err` : hint ? `${name}-hint` : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cx(
                "relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked
                  ? tone === "accent"
                    ? "border-accent-text bg-accent-soft font-semibold text-accent-text"
                    : "border-primary bg-primary-soft font-semibold text-primary-strong"
                  : "border-line bg-surface text-ink hover:bg-surface-2"
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-err`} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[0.95rem] font-medium text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="text-xs leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-line"
        )}
      >
        <span
          aria-hidden
          className={cx(
            "inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-7" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 py-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--c-primary)]"
        aria-describedby={description ? `${id}-d` : undefined}
      />
      <div>
        <label htmlFor={id} className="text-[0.95rem] text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="text-xs text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Misc ---------------- */

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "primary" | "accent" | "food" | "thanks" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    primary: "bg-primary-soft text-primary-strong",
    accent: "bg-accent-soft text-accent-text",
    food: "bg-food-soft text-ink",
    thanks: "bg-thanks-soft text-ink"
  } as const;
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 px-5 py-8 text-center">
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = "info", icon }: { children: ReactNode; tone?: "info" | "caution"; icon?: ReactNode }) {
  return (
    <div
      className={cx(
        "flex gap-3 rounded-2xl px-4 py-3 text-sm leading-relaxed",
        tone === "caution" ? "bg-accent-soft text-ink" : "bg-primary-soft text-ink"
      )}
    >
      {icon && <span className="mt-0.5 shrink-0 text-primary" aria-hidden>{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** 機微な内容をぼかし、本人がタップしたときだけ表示する */
export function SensitiveText({ blur, children, label = "内容を表示" }: { blur: boolean; children: ReactNode; label?: string }) {
  const [shown, setShown] = useState(false);
  if (!blur || shown) return <>{children}</>;
  return (
    <span className="relative inline-flex max-w-full items-center gap-2">
      <span aria-hidden className="pointer-events-none select-none blur-[6px]">
        {children}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShown(true);
        }}
        className="absolute inset-0 inline-flex items-center justify-center gap-1 rounded-lg text-xs font-medium text-muted"
      >
        <Eye aria-hidden size={14} />
        {label}
      </button>
    </span>
  );
}

/* ---------------- Dialog ---------------- */

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  // onClose は毎回新しい関数になりうるので ref に持ち、フォーカス管理の effect を開閉時だけ動かす
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])") ?? []).filter(
        (n) => !n.hasAttribute("disabled")
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="fade-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={id} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <IconButton label="閉じる" onClick={onClose} className="-mr-2 -mt-2">
            <X aria-hidden size={20} />
          </IconButton>
        </div>
        <div className="text-sm leading-relaxed text-ink">{children}</div>
        {footer && <div className="mt-5 flex flex-col gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: ReactNode; confirm: string; resolve: (v: boolean) => void } | null>(null);
  const ask = useCallback(
    (title: string, body: ReactNode, confirm = "削除する") =>
      new Promise<boolean>((resolve) => setState({ title, body, confirm, resolve })),
    []
  );
  const close = useCallback(
    (v: boolean) => {
      state?.resolve(v);
      setState(null);
    },
    [state]
  );
  const dialog = (
    <Dialog
      open={!!state}
      title={state?.title ?? ""}
      onClose={() => close(false)}
      footer={
        <>
          <Button variant="danger" full onClick={() => close(true)}>
            {state?.confirm}
          </Button>
          <Button variant="secondary" full onClick={() => close(false)}>
            キャンセル
          </Button>
        </>
      }
    >
      {state?.body}
    </Dialog>
  );
  return { ask, dialog };
}

/* ---------------- Toast ---------------- */

const ToastCtx = createContext<(msg: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
        {msg && <div className="fade-in rounded-full bg-ink px-5 py-2.5 text-sm text-bg shadow-lg">{msg}</div>}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
