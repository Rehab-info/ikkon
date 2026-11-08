import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import { EmptyState, Notice, Page, TextArea, TextField, useConfirm, useToast } from "../../components/ui";
import { FormActions } from "../../components/FormActions";
import { useEditable } from "../../components/useEditable";
import { LIMITS, type FieldErrors } from "../../lib/validate";
import { ValidationError, saveMemory } from "../../db/repo";
import { goBack, navigate } from "../../lib/router";

export function MemoryEditPage({ id }: { id?: string }) {
  const { db } = useApp();
  const toast = useToast();
  const { ask, dialog } = useConfirm();
  const { loaded, item } = useEditable(db.intimacyMemories, id);
  const [f, setF] = useState({ date: "", title: "", positiveExperience: "", feelings: "", wouldLikeAgain: "", notes: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (item)
      setF({
        date: item.date ?? "",
        title: item.title,
        positiveExperience: item.positiveExperience ?? "",
        feelings: item.feelings ?? "",
        wouldLikeAgain: item.wouldLikeAgain ?? "",
        notes: item.notes ?? ""
      });
  }, [item]);
  if (!loaded) return null;
  if (id && !item) return <Page title="見つかりません" back="/intimacy"><EmptyState title="この記録は削除されたか、存在しません" /></Page>;
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Page title={id ? "体験の記録を編集" : "良かった体験を残す"} eyebrow="Intimacy" back="/intimacy?tab=memories">
      {dialog}
      <Notice>自分のための記録です。点数や評価はつけません。この記録は共有文に入りません。</Notice>
      <form
        className="mt-5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await saveMemory(db, f, id);
            toast("保存しました");
            navigate("/intimacy?tab=memories", { replace: true });
          } catch (err) {
            if (err instanceof ValidationError) setErrors(err.fields);
            else throw err;
          } finally {
            setSaving(false);
          }
        }}
      >
        <TextField label="日付" type="date" optional value={f.date} onChange={set("date")} error={errors.date} />
        <TextField label="タイトル" value={f.title} onChange={set("title")} maxLength={LIMITS.title} error={errors.title} placeholder="例:雨の日曜日" />
        <TextArea label="心地よかったこと" optional value={f.positiveExperience} onChange={set("positiveExperience")} />
        <TextArea label="うれしかったこと" optional value={f.feelings} onChange={set("feelings")} />
        <TextArea label="また希望すること" optional value={f.wouldLikeAgain} onChange={set("wouldLikeAgain")} />
        <TextArea label="自由記述" optional value={f.notes} onChange={set("notes")} rows={4} />
        <FormActions
          saving={saving}
          onCancel={() => goBack("/intimacy?tab=memories")}
          onDelete={
            id
              ? async () => {
                  if (await ask("この記録を削除しますか？", "この端末から削除します。元に戻せません。")) {
                    await db.intimacyMemories.delete(id);
                    toast("削除しました");
                    navigate("/intimacy?tab=memories", { replace: true });
                  }
                }
              : undefined
          }
        />
      </form>
    </Page>
  );
}
