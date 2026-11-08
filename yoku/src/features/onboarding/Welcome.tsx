import { useState } from "react";
import { Lock, ShieldCheck, Smartphone } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, Checkbox } from "../../components/ui";
import { LogoMark } from "../../components/Logo";
import { href } from "../../lib/router";

export function Welcome() {
  const { updateSettings, enterDemo } = useApp();
  const [adult, setAdult] = useState(false);
  return (
    <main className="fade-in mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size={64} />
        <h1 className="font-brand mt-5 text-3xl font-semibold text-ink">YOKU</h1>
        <p className="mt-3 font-serif text-lg text-ink">自分を知る。ふたりをもっと知る。</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          食欲・睡眠・性欲、好きなこと、美味しかったもの、ありがとう。
          <br />
          採点するのではなく、自分を知り、伝えたいときに伝えるためのアプリです。
        </p>
      </div>

      <ul className="mb-8 space-y-3 text-sm">
        <li className="flex gap-3">
          <Smartphone aria-hidden className="mt-0.5 shrink-0 text-primary" size={20} />
          <span>記録はこの端末の中だけに保存されます。サーバーへの送信・アカウント登録はありません。</span>
        </li>
        <li className="flex gap-3">
          <Lock aria-hidden className="mt-0.5 shrink-0 text-primary" size={20} />
          <span>すべての記録は非公開です。共有は、あなたが文章を確認して送る操作をしたときだけです。</span>
        </li>
        <li className="flex gap-3">
          <ShieldCheck aria-hidden className="mt-0.5 shrink-0 text-primary" size={20} />
          <span>医療・診断のアプリではありません。記録の変化は「関連」であり、原因を示すものではありません。</span>
        </li>
      </ul>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-1 text-sm font-medium text-ink">ご利用にあたって</p>
        <p className="mb-2 text-xs leading-relaxed text-muted">
          YOKU は成人(18歳以上)の方を対象にしています。性的な好みを扱う機能を含みます。
        </p>
        <Checkbox label="私は18歳以上です" checked={adult} onChange={setAdult} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Button full disabled={!adult} onClick={() => void updateSettings({ adultConfirmed: true })}>
          はじめる
        </Button>
        <Button full variant="secondary" disabled={!adult} onClick={() => void enterDemo()}>
          デモデータで試してみる
        </Button>
        <a href={href("/privacy")} className="mt-1 text-center text-sm text-primary underline underline-offset-4">
          プライバシーについて読む
        </a>
      </div>
    </main>
  );
}
