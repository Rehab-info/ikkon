import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Checkbox, EmptyState, Page, TextArea, TextField, buttonClass, useConfirm, useToast } from "../../components/ui";
import { FormActions } from "../../components/FormActions";
import { useEditable } from "../../components/useEditable";
import { LIMITS, type FieldErrors } from "../../lib/validate";
import { THANKS_TEMPLATES } from "../../lib/labels";
import { ValidationError, saveGratitude } from "../../db/repo";
import { goBack, navigate } from "../../lib/router";
import { todayISO } from "../../lib/date";

export function ThanksEditPage({ id, template }: { id?: string; template: string | null }) {
  const { db } = useApp();
  const toast = useToast();
  const { ask, dialog } = useConfirm();
  const { loaded, item } = useEditable(db.gratitude, id);
  const tpl = template && THANKS_TEMPLATES.includes(template) ? template : "";
  const [f, setF] = useState({ date: todayISO(), recipient: "", reason: tpl, feeling: "", message: "" });
  const [shared, setShared] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!item) return;
    setF({ date: item.date, recipient: item.recipient ?? "", reason: item.reason, feeling: item.feeling ?? "", message: item.message ?? "" });
    setShared(!!item.shared);
  }, [item]);
  if (!loaded) return null;
  if (id && !item) return <Page title="見つかりません" back="/thanks"><EmptyState title="この記録は削除されたか、存在しません" /></Page>;
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save(thenShare: boolean) {
    setSaving(true);
    try {
      const saved = await saveGratitude(db, { ...f, shared }, id);
      toast("保存しました");
      navigate(thenShare ? `/share?kind=thanks&ids=${saved.id}` : "/thanks", { replace: true });
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fields);
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={id ? "ありがとうを編集" : "ありがとうを記録"} eyebrow="Thanks" back="/thanks">
      {dialog}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <TextField label="感謝した日" type="date" value={f.date} onChange={set("date")} error={errors.date} />
        <TextField label="感謝した相手" optional value={f.recipient} onChange={set("recipient")} maxLength={LIMITS.short} placeholder="例:パートナー" />
        <TextArea label="何に感謝しているか" value={f.reason} onChange={set("reason")} error={errors.reason} rows={2} />
        <TextArea label="そのときの気持ち" optional value={f.feeling} onChange={set("feeling")} rows={2} hint="気持ちの欄は、共有文に自動では入りません。" />
        <TextArea
          label="伝えたいメッセージ"
          optional
          value={f.message}
          onChange={set("message")}
          rows={3}
          hint="共有文の下書きには、この欄(空なら「何に感謝しているか」)が入ります。"
        />
        <div className="rounded-2xl border border-line bg-surface px-4 py-1">
          <Checkbox label="もう伝えた" checked={shared} onChange={setShared} description="自分のための印です。相手には通知されません。" />
        </div>
        <button type="button" disabled={saving} onClick={() => void save(true)} className={`${buttonClass("soft", true)} mt-5`}>
          <Send aria-hidden size={18} />
          保存して、伝える文を作る
        </button>
        <FormActions
          saving={saving}
          onCancel={() => goBack("/thanks")}
          onDelete={
            id
              ? async () => {
                  if (await ask("この記録を削除しますか？", "この端末から削除します。元に戻せません。")) {
                    await db.gratitude.delete(id);
                    toast("削除しました");
                    navigate("/thanks", { replace: true });
                  }
                }
              : undefined
          }
        />
      </form>
    </Page>
  );
}
