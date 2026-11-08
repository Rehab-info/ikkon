import { useLiveQuery } from "dexie-react-hooks";
import { Check, HandHeart, Plus, Send } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Card, Chip, EmptyState, Page, Section, buttonClass } from "../../components/ui";
import { DomainBadge } from "../../components/domains";
import { THANKS_TEMPLATES } from "../../lib/labels";
import { formatJaDate, formatMonth } from "../../lib/date";
import { href } from "../../lib/router";
import type { GratitudeEntry } from "../../db/types";

export function ThanksPage() {
  const { db } = useApp();
  const entries = useLiveQuery(() => db.gratitude.orderBy("date").reverse().toArray(), [db]);
  if (!entries) return null;
  const groups = new Map<string, GratitudeEntry[]>();
  for (const g of entries) groups.set(formatMonth(g.date), [...(groups.get(formatMonth(g.date)) ?? []), g]);

  return (
    <Page title="Thanks" subtitle="ありがとうと、うれしかった出来事" actions={<DomainBadge domain="thanks" />}>
      <Section title="テンプレートから書く">
        <ul className="flex flex-wrap gap-2">
          {THANKS_TEMPLATES.map((t) => (
            <li key={t}>
              <a
                href={href(`/thanks/new?template=${encodeURIComponent(t)}`)}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm text-ink hover:bg-thanks-soft"
              >
                {t}
              </a>
            </li>
          ))}
        </ul>
        <a href={href("/thanks/new")} className={`${buttonClass("primary", true)} mt-4`}>
          <Plus aria-hidden size={18} />
          自由に書く
        </a>
      </Section>

      <Section title="ふりかえり" description="伝えるかどうかは自由です。記録しておくだけでも大丈夫。">
        {entries.length === 0 ? (
          <EmptyState icon={<HandHeart size={22} />} title="まだ記録がありません">
            小さなことでも、ありがとうと思ったことを残してみませんか。
          </EmptyState>
        ) : (
          [...groups.entries()].map(([month, items]) => (
            <div key={month} className="mb-5">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted">{month}</h3>
              <ul className="space-y-3">
                {items.map((g) => (
                  <Card as="li" key={g.id}>
                    <a href={href(`/thanks/${g.id}`)} className="block">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>{formatJaDate(g.date)}</span>
                        {g.recipient && <Chip tone="thanks">{g.recipient}へ</Chip>}
                        {g.shared && (
                          <span className="inline-flex items-center gap-0.5">
                            <Check aria-hidden size={12} />
                            伝えた
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-medium text-ink">{g.reason}</p>
                      {g.message && <p className="mt-1 line-clamp-2 text-sm text-muted">「{g.message}」</p>}
                    </a>
                    <a href={href(`/share?kind=thanks&ids=${g.id}`)} className={`${buttonClass("soft", false, "sm")} mt-3`}>
                      <Send aria-hidden size={16} />
                      伝える文を作る
                    </a>
                  </Card>
                ))}
              </ul>
            </div>
          ))
        )}
      </Section>
    </Page>
  );
}
