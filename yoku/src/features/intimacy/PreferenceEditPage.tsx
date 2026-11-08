import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import { Pencil, Send } from "lucide-react";
import { Card, ChoiceGroup, Chip, EmptyState, Notice, Page, Select, TextArea, TextField, buttonClass, useConfirm, useToast } from "../../components/ui";
import { TagInput } from "../../components/TagInput";
import { FormActions } from "../../components/FormActions";
import { useEditable } from "../../components/useEditable";
import { CATEGORY_DEFAULT_STATUS, CATEGORY_EXAMPLE, CATEGORY_LABEL, CATEGORY_ORDER, PREF_STATUS_LABEL, PREF_STATUS_ORDER } from "../../lib/labels";
import { LIMITS, isCategory } from "../../lib/validate";
import { ValidationError, savePreference } from "../../db/repo";
import { goBack, href, navigate } from "../../lib/router";
import { canRequestAgain } from "../../lib/request";
import { daysBetween } from "../../lib/date";
import { RequestActionCard } from "./RequestActionCard";
import type { IntimacyCategory, IntimacyPreference, IntimacyPreferenceStatus } from "../../db/types";
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
  /** 既存の記録は、まず詳細を表示し、「好みを編集」でフォームに切り替える */
  const [editing, setEditing] = useState(!id);

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
  if (item && !editing) return <PreferenceDetail item={item} onEdit={() => setEditing(true)} />;

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
          placeholder={CATEGORY_EXAMPLE[category].split("、")[0]}
          hint={`${CATEGORY_EXAMPLE[category]}。自分の言葉でそのまま書いてOKです。共有文を作るときは、選んだ項目の名前とステータスだけが下書きに入ります。`}
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

const STALE_DAYS = 90;

/** 好みの詳細。編集・もう一度お願いしたい・共有メッセージの作成への入口 */
function PreferenceDetail({ item, onEdit }: { item: IntimacyPreference; onEdit: () => void }) {
  const requestable = canRequestAgain(item);
  const requestCategory = ["play", "position", "again"].includes(item.category);
  const stale = daysBetween(new Date(item.updatedAt), new Date()) >= STALE_DAYS;
  return (
    <Page title={item.title} eyebrow={`Intimacy・${CATEGORY_LABEL[item.category]}`} back="/intimacy">
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">今の気持ち</span>
          <Chip tone={item.status === "like" || item.status === "curious" ? "accent" : "neutral"}>{PREF_STATUS_LABEL[item.status]}</Chip>
          {item.tags.map((t) => (
            <Chip key={t}>#{t}</Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">最終更新:{new Date(item.updatedAt).toLocaleDateString("ja-JP")}</p>
        {stale && <p className="mt-1 text-xs text-muted">しばらく見直していません。今の気持ちと合っていますか？</p>}
        {item.notes && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs text-muted">メモ(自分だけが見られます。共有文には入りません)</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.notes}</p>
          </div>
        )}
      </Card>

      {requestable && (
        <div className="mb-5">
          <RequestActionCard to={`/intimacy/request?preference=${item.id}`} />
        </div>
      )}
      {requestCategory && !requestable && (
        <div className="mb-5">
          <Notice>今の気持ちが「{PREF_STATUS_LABEL[item.status]}」なので、「もう一度お願いしたい」は表示していません。気持ちが変わったら、編集から変えられます。</Notice>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <a href={href(`/share?kind=intimacy&ids=p:${item.id}`)} className={buttonClass("secondary", true)}>
          <Send aria-hidden size={18} />
          共有メッセージを作成
        </a>
        <button type="button" onClick={onEdit} className={buttonClass("ghost", true)}>
          <Pencil aria-hidden size={18} />
          好みを編集
        </button>
      </div>
    </Page>
  );
}
