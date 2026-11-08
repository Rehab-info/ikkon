import { ChevronRight, MessageCircle } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Card, Notice, Page, Section } from "../../components/ui";
import { DomainBadge, type DomainKey } from "../../components/domains";
import { TOPICS } from "../../lib/labels";
import { href } from "../../lib/router";

interface Action {
  to: string;
  title: string;
  description: string;
  domain: DomainKey;
}

export function TogetherPage() {
  const { settings } = useApp();
  const actions: Action[] = [
    { to: "/share?kind=feeling", title: "今日伝えたい気持ち", description: "数値ではなく、言葉でそっと伝える", domain: "wellness" },
    ...(settings.showIntimacy
      ? [{ to: "/share?kind=intimacy", title: "好みについて話す", description: "選んだ項目の名前とステータスだけ", domain: "intimacy" as const }]
      : []),
    { to: "/share?kind=food", title: "また食べたいものを伝える", description: "美味しかった記憶から、次の約束へ", domain: "food" },
    { to: "/share?kind=thanks", title: "ありがとうを伝える", description: "記録した感謝を、言葉にして届ける", domain: "thanks" }
  ];
  const topics = TOPICS.filter((t) => !t.intimacy || settings.showIntimacy);

  return (
    <Page title="Together" subtitle="伝えたいことを、自分のタイミングで" actions={<DomainBadge domain="together" />}>
      <Notice>
        YOKU は相手のデータを受け取ったり同期したりしません。共有は、あなたが文章を確認してメッセージアプリなどで送るときだけです。既読や催促の機能はありません。
      </Notice>

      <Section title="伝える" className="mt-6">
        <ul className="space-y-3">
          {actions.map((a) => (
            <li key={a.to}>
              <a href={href(a.to)} className="block">
                <Card className="flex items-center gap-3">
                  <DomainBadge domain={a.domain} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{a.title}</span>
                    <span className="block text-xs text-muted">{a.description}</span>
                  </span>
                  <ChevronRight aria-hidden size={18} className="text-muted" />
                </Card>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="ふたりの対話テーマ" description="話すきっかけに。答えを急がなくて大丈夫です。">
        <Card>
          <ul className="-my-1 divide-y divide-line">
            {topics.map((t) => (
              <li key={t.id}>
                <a href={href(`/share?kind=topic&topic=${t.id}`)} className="flex items-center gap-3 py-3">
                  <MessageCircle aria-hidden size={18} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 text-[0.95rem] text-ink">{t.text}</span>
                  <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    </Page>
  );
}
