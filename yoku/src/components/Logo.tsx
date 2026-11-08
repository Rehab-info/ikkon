export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="18" fill="var(--c-primary)" />
      <circle cx="26" cy="33" r="12" fill="none" stroke="#FAF9F6" strokeWidth="3.5" />
      <circle cx="38" cy="33" r="12" fill="none" stroke="#C88F91" strokeWidth="3.5" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-brand text-lg font-semibold text-ink">YOKU</span>
    </span>
  );
}
