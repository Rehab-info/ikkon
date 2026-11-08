import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import { ChoiceGroup, EmptyState, Page, TextArea, TextField, useConfirm, useToast } from "../../components/ui";
import { FormActions } from "../../components/FormActions";
import { useEditable } from "../../components/useEditable";
import { BOUNDARY_STATUS_LABEL, BOUNDARY_STATUS_ORDER } from "../../lib/labels";
import { LIMITS, type FieldErrors } from "../../lib/validate";
import { ValidationError, saveBoundary } from "../../db/repo";
import { goBack, navigate } from "../../lib/router";
import type { BoundaryStatus } from "../../db/types";

export function BoundaryEditPage({ id }: { id?: string }) {
  const { db } = useApp();
  const toast = useToast();
  const { ask, dialog } = useConfirm();
  const { loaded, item } = useEditable(db.intimacyBoundaries, id);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<BoundaryStatus | "">(id ? "" : "undecided");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setStatus(item.status);
    setNotes(item.notes ?? "");
  }, [item]);
  if (!loaded) return null;
  if (id && !item) return <Page title="見つかりません" back="/intimacy"><EmptyState title="この記録は削除されたか、存在しません" /></Page>;
  return (
    <Page title={id ? "希望・境界線を編集" : "希望・境界線を追加"} eyebrow="Intimacy" back="/intimacy?tab=boundaries">
      {dialog}
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await saveBoundary(db, { title, status, notes }, id);
            toast("保存しました");
            navigate("/intimacy?tab=boundaries", { replace: true });
          } catch (err) {
            if (err instanceof ValidationError) setErrors(err.fields);
            else throw err;
          } finally {
            setSaving(false);
          }
        }}
      >
        <TextField label="内容" value={title} onChange={setTitle} maxLength={LIMITS.title} error={errors.title} placeholder="例:ゴムは必ずつける、生理中はしない、アナルはしない" />
        <ChoiceGroup
          label="今の気持ち"
          value={status}
          onChange={setStatus}
          options={BOUNDARY_STATUS_ORDER.map((s) => ({ value: s, label: BOUNDARY_STATUS_LABEL[s] }))}
          error={errors.status}
          tone="accent"
          hint="ここに書いたことは、その場の気持ちより優先されるものではありません。"
        />
        <TextArea label="メモ" optional value={notes} onChange={setNotes} hint="メモは共有文に自動では入りません。" />
        <FormActions
          saving={saving}
          onCancel={() => goBack("/intimacy?tab=boundaries")}
          onDelete={
            id
              ? async () => {
                  if (await ask("この記録を削除しますか？", "この端末から削除します。元に戻せません。")) {
                    await db.intimacyBoundaries.delete(id);
                    toast("削除しました");
                    navigate("/intimacy?tab=boundaries", { replace: true });
                  }
                }
              : undefined
          }
        />
      </form>
    </Page>
  );
}
