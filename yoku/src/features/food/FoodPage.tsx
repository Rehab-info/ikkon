import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Heart, Plus, Search, Send, Star, Utensils } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Card, Chip, EmptyState, IconButton, Page, Section, buttonClass, cx } from "../../components/ui";
import { DomainBadge } from "../../components/domains";
import { GENRE_LABEL, GENRE_ORDER } from "../../lib/labels";
import { formatJaDate, formatMonth } from "../../lib/date";
import { href } from "../../lib/router";
import { cleanupOrphanPhotos, toggleFoodFlag } from "../../db/repo";
import type { FoodGenre, FoodMemory } from "../../db/types";
import { PhotoView } from "./PhotoView";

type Filter = "all" | "favorite" | "wantAgain";

export function filterFoods(foods: readonly FoodMemory[], q: string, genre: FoodGenre | "all", filter: Filter): FoodMemory[] {
  const query = q.trim().toLowerCase();
  return foods
    .filter((f) => genre === "all" || f.genre === genre)
    .filter((f) => (filter === "favorite" ? f.favorite : filter === "wantAgain" ? f.wantAgain : true))
    .filter((f) => {
      if (!query) return true;
      return [f.dishName, f.restaurantName, f.location, f.highlights, f.notes, f.companion, GENRE_LABEL[f.genre]]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(query));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function FoodPage() {
  const { db } = useApp();
  const foods = useLiveQuery(() => db.foods.toArray(), [db]);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<FoodGenre | "all">("all");
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    void cleanupOrphanPhotos(db);
  }, [db]);
  const list = useMemo(() => filterFoods(foods ?? [], q, genre, filter), [foods, q, genre, filter]);
  if (!foods) return null;

  const groups = new Map<string, FoodMemory[]>();
  for (const f of list) {
    const m = formatMonth(f.date);
    groups.set(m, [...(groups.get(m) ?? []), f]);
  }

  return (
    <Page title="Food" subtitle="美味しかった料理と、その時間の記憶" actions={<DomainBadge domain="food" />}>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <a href={href("/food/new")} className={buttonClass("primary", true)}>
          <Plus aria-hidden size={18} />
          記録する
        </a>
        <a href={href("/share?kind=food")} className={buttonClass("secondary", true)}>
          <Send aria-hidden size={18} />
          伝える
        </a>
      </div>

      <div role="search" className="mb-4">
        <label htmlFor="food-q" className="sr-only">
          料理・お店・メモを検索
        </label>
        <div className="relative">
          <Search aria-hidden size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="food-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="料理・お店・メモを検索"
            className="w-full rounded-full border border-line bg-surface py-3 pl-10 pr-4 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="表示する記録">
        {(
          [
            ["all", "すべて"],
            ["favorite", "お気に入り"],
            ["wantAgain", "また食べたい"]
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
            className={cx(
              "min-h-10 shrink-0 rounded-full border px-4 text-sm",
              filter === v ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "border-line bg-surface text-ink"
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="mb-6">
        <label htmlFor="food-genre" className="sr-only">
          ジャンル
        </label>
        <select
          id="food-genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value as FoodGenre | "all")}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink"
        >
          <option value="all">すべてのジャンル</option>
          {GENRE_ORDER.map((g) => (
            <option key={g} value={g}>
              {GENRE_LABEL[g]}
            </option>
          ))}
        </select>
      </div>

      {foods.length === 0 ? (
        <EmptyState icon={<Utensils size={22} />} title="まだ記録がありません" action={<a href={href("/food/new")} className={buttonClass("soft")}>最初の一皿を記録する</a>}>
          写真は端末の中だけに保存されます。
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState title="条件に合う記録がありません" />
      ) : (
        [...groups.entries()].map(([month, items]) => (
          <Section key={month} title={month}>
            <ul className="space-y-3">
              {items.map((f) => (
                <Card as="li" key={f.id} padded={false}>
                  <div className="flex gap-3 p-3">
                    <a href={href(`/food/${f.id}`)} className="flex min-w-0 flex-1 gap-3">
                      {f.photoId ? (
                        <PhotoView photoId={f.photoId} alt={`${f.dishName}の写真`} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-food-soft text-[color:var(--c-food)]">
                          <Utensils size={24} strokeWidth={1.6} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-muted">{formatJaDate(f.date)}</span>
                        <span className="block truncate font-medium text-ink">{f.dishName}</span>
                        {f.restaurantName && <span className="block truncate text-sm text-muted">{f.restaurantName}</span>}
                        <span className="mt-1 flex flex-wrap gap-1">
                          <Chip tone="food">{GENRE_LABEL[f.genre]}</Chip>
                          {f.wantAgain && <Chip tone="primary">また食べたい</Chip>}
                        </span>
                      </span>
                    </a>
                    <div className="-mr-1 flex flex-col">
                      <IconButton
                        label={f.favorite ? `${f.dishName}をお気に入りから外す` : `${f.dishName}をお気に入りにする`}
                        aria-pressed={!!f.favorite}
                        onClick={() => void toggleFoodFlag(db, f.id, "favorite")}
                      >
                        <Star aria-hidden size={20} className={f.favorite ? "fill-[color:var(--c-food)] text-[color:var(--c-food)]" : ""} />
                      </IconButton>
                      <IconButton
                        label={f.wantAgain ? `${f.dishName}を「また食べたい」から外す` : `${f.dishName}を「また食べたい」にする`}
                        aria-pressed={!!f.wantAgain}
                        onClick={() => void toggleFoodFlag(db, f.id, "wantAgain")}
                      >
                        <Heart aria-hidden size={20} className={f.wantAgain ? "fill-accent text-accent" : ""} />
                      </IconButton>
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
          </Section>
        ))
      )}
    </Page>
  );
}
