import { Heart } from "lucide-react";
import { cx } from "../../components/ui";
import { href } from "../../lib/router";
import { REQUEST_NOTICE } from "../../lib/request";

/** 詳細画面の「もう一度お願いしたい ♡」。共有はせず、共有文を作る画面へ移るだけ */
export function RequestActionCard({ to }: { to: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-accent/40 bg-accent-soft p-4">
      <p className="mb-1 text-sm font-medium text-ink">口に出すのは、ちょっと照れくさいときに。</p>
      <p className="mb-3 text-xs leading-relaxed text-ink">
        やさしい文章をつくって、送るかどうかは最後に自分で決められます。作るだけでは何も送られません。
      </p>
      <a href={href(to)} className={cx(
          "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[0.95rem] font-medium transition",
          "bg-accent-text text-white hover:brightness-110 dark:text-[#2a1517]"
        )}>
        <Heart aria-hidden size={18} />
        もう一度お願いしたい
        <span aria-hidden>♡</span>
      </a>
      <p className="mt-3 text-[0.72rem] leading-relaxed text-muted">{REQUEST_NOTICE}</p>
    </div>
  );
}
