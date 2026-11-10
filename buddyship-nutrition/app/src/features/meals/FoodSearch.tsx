import { useState, type FormEvent } from 'react';
import type { FoodRef } from '@buddyship/shared';
import { api } from '@/lib/api.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { ErrorNotice } from '@/components/ErrorNotice.tsx';

/** 食品成分表から食品を探す(手入力・要確認の修正用) */
export function FoodSearch({ onSelect, label = '食べものの名前' }: { onSelect: (f: FoodRef) => void; label?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodRef[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const id = `food-search-${label}`;

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setResults(await api.searchFoods(q.trim()));
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-muted p-3">
      <form onSubmit={search} className="flex flex-col gap-2" role="search">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="例:ごはん、にんじん" />
        <Button type="submit" variant="secondary" disabled={!q.trim()}>
          探す
        </Button>
      </form>
      <ErrorNotice error={error} />
      {results?.length === 0 && <p className="text-lg">見つかりませんでした。別の言葉で探してください。</p>}
      {results && results.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="見つかった食品">
          {results.slice(0, 8).map((f) => (
            <li key={f.food_id}>
              <Button variant="quiet" className="justify-start text-left" onClick={() => onSelect(f)}>
                {f.display_name}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
