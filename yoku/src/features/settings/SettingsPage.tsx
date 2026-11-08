import { useEffect, useState } from "react";
import { ChevronRight, Download, FlaskConical, HardDrive, Shield, Trash2 } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, Card, ChoiceGroup, Dialog, Notice, Page, Section, TextField, Toggle, useToast } from "../../components/ui";
import { countAll, totalPhotoBytes, PHOTO_LIMITS } from "../../db/repo";
import { buildExport, downloadJson, formatBytes } from "../../lib/export";
import { todayISO } from "../../lib/date";
import { href } from "../../lib/router";
import type { ThemePreference } from "../../db/types";
import { IS_PREVIEW } from "../../lib/env";

const TABLE_LABEL: Record<string, string> = {
  wellness: "Wellness",
  intimacyPreferences: "Intimacy:好み",
  intimacyMemories: "Intimacy:体験",
  intimacyBoundaries: "Intimacy:境界線",
  foods: "Food",
  photos: "Food:写真",
  gratitude: "Thanks"
};

function StorageInfo() {
  const { db } = useApp();
  const [info, setInfo] = useState<{ counts: Record<string, number>; photos: number; usage?: number; quota?: number; persisted?: boolean }>();
  const toast = useToast();
  const refresh = async () => {
    const [counts, photos] = await Promise.all([countAll(db), totalPhotoBytes(db)]);
    let usage: number | undefined, quota: number | undefined, persisted: boolean | undefined;
    try {
      const est = await navigator.storage?.estimate?.();
      usage = est?.usage;
      quota = est?.quota;
      persisted = await navigator.storage?.persisted?.();
    } catch {
      /* 対応していないブラウザー */
    }
    setInfo({ counts, photos, usage, quota, persisted });
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);
  if (!info) return null;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(info.counts).map(([k, v]) => (
          <div key={k} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
            <dt className="text-muted">{TABLE_LABEL[k] ?? k}</dt>
            <dd className="tabular-nums text-ink">{v}件</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-ink">
        写真:{formatBytes(info.photos)} / 上限 {formatBytes(PHOTO_LIMITS.maxTotalBytes)}
      </p>
      {info.usage !== undefined && (
        <p className="text-sm text-ink">
          このアプリの使用量(ブラウザーの推定):{formatBytes(info.usage)}
          {info.quota ? ` / 利用可能 ${formatBytes(info.quota)}` : ""}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        {info.persisted
          ? "ブラウザーに「消さずに保存」を許可されています。"
          : "容量が足りなくなると、ブラウザーが自動でデータを消すことがあります。大切な記録は書き出して保管してください。"}
      </p>
      {!info.persisted && typeof navigator.storage?.persist === "function" && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={async () => {
            const ok = await navigator.storage.persist();
            toast(ok ? "保存を長持ちさせる設定にしました" : "ブラウザーに許可されませんでした");
            void refresh();
          }}
        >
          データを消さないようブラウザーに頼む
        </Button>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, mode, enterDemo, exitDemo, deleteEverything, db } = useApp();
  const toast = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");

  return (
    <Page title="設定" subtitle="表示・プライバシー・データ">
      {mode === "demo" && (
        <div className="mb-6">
          <Notice tone="caution" icon={<FlaskConical size={18} />}>
            いまはデモモードです。表示されているのは架空のデータで、ここでの変更は実データに入りません。デモを終えるとデモデータは消えます。
          </Notice>
        </div>
      )}

      <Section title="表示">
        <Card className="divide-y divide-line px-4 py-1" padded={false}>
          <Toggle
            label="性欲の項目を表示"
            description="Wellness の記録とグラフに表示します。オフにしても、これまでの記録は消えません。"
            checked={settings.showSexualDesire}
            onChange={(v) => void updateSettings({ showSexualDesire: v })}
          />
          <Toggle
            label="Intimacy を表示"
            description="オフにするとホーム・Together・共有から Intimacy が見えなくなります。データは削除されません(削除は下の「すべての記録を削除」から)。"
            checked={settings.showIntimacy}
            onChange={(v) => void updateSettings({ showIntimacy: v })}
          />
          <Toggle
            label="センシティブな内容をぼかす"
            description="Intimacy の一覧で内容をぼかし、タップしたときだけ表示します。ホームの「最近の記録」にも内容を出しません。"
            checked={settings.sensitiveBlur}
            onChange={(v) => void updateSettings({ sensitiveBlur: v })}
          />
          <Toggle
            label="アプリ切替画面で内容を隠す"
            description="アプリが背面に回ったとき画面を覆います。OS やブラウザーによっては効かないことがあります。"
            checked={settings.privacyScreen}
            onChange={(v) => void updateSettings({ privacyScreen: v })}
          />
          <div className="pt-3">
            <ChoiceGroup<ThemePreference>
              label="テーマ"
              value={settings.theme}
              onChange={(v) => void updateSettings({ theme: v })}
              options={[
                { value: "system", label: "端末に合わせる" },
                { value: "light", label: "ライト" },
                { value: "dark", label: "ダーク" }
              ]}
            />
          </div>
        </Card>
      </Section>

      <Section title="プライバシー">
        <Card padded={false}>
          <a href={href("/privacy")} className="flex items-center gap-3 px-4 py-4">
            <Shield aria-hidden size={20} className="text-primary" />
            <span className="flex-1 text-[0.95rem] text-ink">プライバシーと安全について</span>
            <ChevronRight aria-hidden size={18} className="text-muted" />
          </a>
        </Card>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          ベータ版にはアプリ内ロック(PIN)はありません。端末の画面ロックを使ってください。端末を他の人と共有している場合や、画面を見られる心配がある場合は、Intimacy を非表示にできます。
        </p>
      </Section>

      <Section title="データ">
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
            <HardDrive aria-hidden size={18} className="text-primary" />
            保存容量{mode === "demo" ? "(デモデータ)" : ""}
          </div>
          <StorageInfo />
        </Card>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="secondary" full disabled={IS_PREVIEW} onClick={() => setExportOpen(true)}>
            <Download aria-hidden size={18} />
            すべての記録を書き出す(JSON)
          </Button>
          {IS_PREVIEW && <p className="text-center text-xs text-muted">プレビュー版ではファイルを保存できないため、書き出しは使えません。</p>}
          <Button variant="ghost" full className="text-danger hover:bg-danger-soft" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden size={18} />
            すべての記録を削除
          </Button>
        </div>
      </Section>

      <Section title="デモモード" description="架空のデータで4つの領域を試せます。実データとは別の場所に保存します。">
        {mode === "demo" ? (
          <Button full onClick={() => void exitDemo().then(() => toast("デモを終了しました"))}>
            デモを終了して実データに戻る
          </Button>
        ) : (
          <Button variant="secondary" full onClick={() => void enterDemo().then(() => toast("デモモードを開始しました"))}>
            <FlaskConical aria-hidden size={18} />
            デモモードを始める
          </Button>
        )}
      </Section>

      <Section title="このアプリについて">
        <p className="text-xs leading-relaxed text-muted">
          YOKU ベータ版 0.1。医療機器・診断・治療のためのアプリではありません。記録の変化は主観的な目安で、関係の良し悪しや健康状態を判定するものではありません。
          Intimacy・Food・Thanks の記録と共有の機能は、効果が確かめられたものではなく、使い心地を確かめるための試作です。
        </p>
      </Section>

      <Dialog
        open={exportOpen}
        title="記録を書き出す"
        onClose={() => setExportOpen(false)}
        footer={
          <>
            <Button
              full
              onClick={async () => {
                const data = await buildExport(db);
                downloadJson(data, `yoku-${mode === "demo" ? "demo-" : ""}export-${todayISO()}.json`);
                setExportOpen(false);
                toast("書き出しました");
              }}
            >
              書き出す
            </Button>
            <Button variant="secondary" full onClick={() => setExportOpen(false)}>
              キャンセル
            </Button>
          </>
        }
      >
        <p>
          {mode === "demo" ? "デモデータ" : "すべての記録"}(Intimacy・写真を含む)を、暗号化されていない JSON ファイルとして端末に保存します。
        </p>
        <p className="mt-2">ファイルを開ける人は誰でも内容を読めます。保存先(クラウドの自動同期フォルダなど)と、送る相手に注意してください。</p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        title="すべての記録を削除"
        onClose={() => {
          setDeleteOpen(false);
          setConfirmWord("");
        }}
        footer={
          <>
            <Button
              variant="danger"
              full
              disabled={confirmWord.trim() !== "削除"}
              onClick={async () => {
                setDeleteOpen(false);
                setConfirmWord("");
                await deleteEverything();
              }}
            >
              完全に削除する
            </Button>
            <Button
              variant="secondary"
              full
              onClick={() => {
                setDeleteOpen(false);
                setConfirmWord("");
              }}
            >
              キャンセル
            </Button>
          </>
        }
      >
        <p>この端末にある YOKU の実データ・デモデータ・写真・設定をすべて削除します。元に戻せません。</p>
        <p className="mt-2">すでに共有した文章は、相手の端末からは削除されません。</p>
        <div className="mt-4">
          <TextField label="確認のため「削除」と入力してください" value={confirmWord} onChange={setConfirmWord} />
        </div>
      </Dialog>
    </Page>
  );
}
