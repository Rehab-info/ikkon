import { HandHeart, Heart, Leaf, Utensils, Users, type LucideIcon } from "lucide-react";

export type DomainKey = "wellness" | "intimacy" | "food" | "thanks" | "together";

export interface DomainMeta {
  key: DomainKey;
  name: string;
  ja: string;
  description: string;
  path: string;
  Icon: LucideIcon;
  /** アイコンの背景と文字色(Tailwind のクラス) */
  tone: string;
}

export const DOMAINS: Record<DomainKey, DomainMeta> = {
  wellness: {
    key: "wellness",
    name: "Wellness",
    ja: "からだと心",
    description: "食欲・睡眠・性欲と、心身の状態",
    path: "/wellness",
    Icon: Leaf,
    tone: "bg-primary-soft text-primary-strong"
  },
  intimacy: {
    key: "intimacy",
    name: "Intimacy",
    ja: "親密さと好み",
    description: "好み・良かった体験・境界線を、自分のために",
    path: "/intimacy",
    Icon: Heart,
    tone: "bg-accent-soft text-accent-text"
  },
  food: {
    key: "food",
    name: "Food",
    ja: "おいしい記憶",
    description: "美味しかった料理と、また食べたいもの",
    path: "/food",
    Icon: Utensils,
    tone: "bg-food-soft text-[color:var(--c-food)]"
  },
  thanks: {
    key: "thanks",
    name: "Thanks",
    ja: "ありがとう",
    description: "感謝と、うれしかった出来事",
    path: "/thanks",
    Icon: HandHeart,
    tone: "bg-thanks-soft text-[color:var(--c-thanks)]"
  },
  together: {
    key: "together",
    name: "Together",
    ja: "ふたりへ",
    description: "伝えたいことを、自分のタイミングで",
    path: "/together",
    Icon: Users,
    tone: "bg-primary-soft text-primary-strong"
  }
};

export function DomainBadge({ domain, size = 40 }: { domain: DomainKey; size?: number }) {
  const d = DOMAINS[domain];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl ${d.tone}`}
      style={{ width: size, height: size }}
    >
      <d.Icon size={Math.round(size * 0.5)} strokeWidth={1.75} />
    </span>
  );
}
