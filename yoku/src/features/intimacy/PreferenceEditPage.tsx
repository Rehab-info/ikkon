import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import { ChoiceGroup, EmptyState, Notice, Page, Select, TextArea, TextField, useConfirm, useToast } from "../../components/ui";
import { TagInput } from "../../components/TagInput";
import { FormActions } from "../../components/FormActions";
import { useEditable } from "../../components/useEditable";
import { CATEGORY_DEFAULT_STATUS, CATEGORY_LABEL, CATEGORY_ORDER, PREF_STATUS_LABEL, PREF_STATUS_ORDER } from "../../lib/labels";
import { LIMITS, isCategory } from "../../lib/validate";
import { ValidationError, savePreference } from "../../db/repo";
import { goBack, navigate } from "../../lib/router";
import type { IntimacyCategory, IntimacyPreferenceStatus } from "../../db/types";
import type { FieldErrors } from "../../lib/validate";

export function PreferenceEditPage({ id, category: categoryParam }: { id?: string; category: string | null }) {
  const { db } = useApp();
  const toast = useToast();
  const { ask, dialog } = useConfirm();
  const { loaded, item } = useEditable(db.intimacyPreferences, id);
  const initialCat: IntimacyCategory = isCategory(categoryParam) ? categoryParam : "play";
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IntimacyCategory>(initialCat);
  const [status, setStatus] = useState<IntimacyPreferenceStatus | "">(id ? "" : CATEGORY_DEFAULT_STATUS[initialCat]);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [statusTouched, setStatusTouched] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setCategory(item.category);
    setStatus(item.status);
    setTags(item.tags);
    setNotes(item.notes ?? "");
  }, [item]);

  if (!loaded) return null;
  if (id && !item) return <Page title="見つかりません" back="/intimacy"><EmptyState title="この記録は削除されたか、存在しません" /></Page>;

  async function onSubmit() {
    setSaving(true);
    try {
      await savePreference(db, { title, category, status, tags, notes }, id);
      toast("保存しました");
      navigate("/intimacy?tab=preferences", { replace: true });
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fields);
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={id ? "好みを編集" : "好みを追加"} eyebrow="Intimacy" back="/intimacy">
      {dialog}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
        noValidate
      >
        <Select
          label="分類"
          value={category}
          onChange={(v) => {
            setCategory(v);
            if (!id && !statusTouched) setStatus(CATEGORY_DEFAULT_STATUS[v]);
          }}
          options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
        />
        <TextField
          label="名前"
          value={title}
          onChange={setTitle}
          maxLength={LIMITS.title}
          error={errors.title}
          placeholder="自由に名前をつけてください"
          hint="共有文を作るとき、選んだ項目の名前とステータスだけが下書きに入ります。"
        />
        <ChoiceGroup
          label="今の気持ち"
          value={status}
          onChange={(v) => {
            setStatusTouched(true);
            setStatus(v);
          }}
          options={PREF_STATUS_ORDER.map((s) => ({ value: s, label: PREF_STATUS_LABEL[s] }))}
          error={errors.status}
          tone="accent"
          hint="以前「好き」だったことも、今は違うかもしれません。気持ちが変わったら、いつでも変えてください。"
        />
        <TagInput value={tags} onChange={setTags} />
        <TextArea label="メモ" optional value={notes} onChange={setNotes} hint="メモは共有文に自動では入りません。" />
        {id && item && (
          <Notice>
            最終更新:{new Date(item.updatedAt).toLocaleDateString("ja-JP")}。保存すると、今の気持ちとして更新されます。
          </Notice>
        )}
        <FormActions
          saving={saving}
          onCancel={() => goBack("/intimacy")}
          onDelete={
            id
              ? async () => {
                  if (await ask("この好みを削除しますか？", "この端末から削除します。元に戻せません。")) {
                    await db.intimacyPreferences.delete(id);
                    toast("削除しました");
                    navigate("/intimacy?tab=preferences", { replace: true });
                  }
                }
              : undefined
          }
        />
      </form>
    </Page>
  );
}
