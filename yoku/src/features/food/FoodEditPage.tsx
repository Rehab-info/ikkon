import { useEffect, useRef, useState } from "react";
import { Camera, ImageOff, Send } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, Checkbox, EmptyState, Notice, Page, Select, TextArea, TextField, buttonClass, useConfirm, useToast } from "../../components/ui";
import { FormActions } from "../../components/FormActions";
import { useEditable } from "../../components/useEditable";
import { GENRE_LABEL, GENRE_ORDER } from "../../lib/labels";
import { LIMITS, type FieldErrors } from "../../lib/validate";
import { StorageLimitError, ValidationError, deleteFood, saveFood, savePhoto } from "../../db/repo";
import { compressImage } from "../../lib/image";
import { goBack, href, navigate } from "../../lib/router";
import { todayISO } from "../../lib/date";
import { formatBytes } from "../../lib/export";
import type { FoodGenre } from "../../db/types";
import { PhotoView, useObjectUrl } from "./PhotoView";

export function FoodEditPage({ id }: { id?: string }) {
  const { db } = useApp();
  const toast = useToast();
  const { ask, dialog } = useConfirm();
  const { loaded, item } = useEditable(db.foods, id);
  const [f, setF] = useState({
    date: todayISO(),
    dishName: "",
    restaurantName: "",
    location: "",
    highlights: "",
    companion: "",
    notes: ""
  });
  const [genre, setGenre] = useState<FoodGenre>("other");
  const [wantAgain, setWantAgain] = useState(false);
  const [favorite, setFavorite] = useState(false);
  /** 新しく選んだ(まだ保存していない)写真 */
  const [pending, setPending] = useState<{ blob: Blob; width: number; height: number } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingUrl = useObjectUrl(pending?.blob);

  useEffect(() => {
    if (!item) return;
    setF({
      date: item.date,
      dishName: item.dishName,
      restaurantName: item.restaurantName ?? "",
      location: item.location ?? "",
      highlights: item.highlights ?? "",
      companion: item.companion ?? "",
      notes: item.notes ?? ""
    });
    setGenre(item.genre);
    setWantAgain(!!item.wantAgain);
    setFavorite(!!item.favorite);
  }, [item]);

  if (!loaded) return null;
  if (id && !item) return <Page title="見つかりません" back="/food"><EmptyState title="この記録は削除されたか、存在しません" /></Page>;
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const existingPhoto = !removePhoto && !pending ? item?.photoId : undefined;

  async function onPick(file: File | undefined) {
    setPhotoError(undefined);
    if (!file) return;
    setProcessing(true);
    try {
      const out = await compressImage(file);
      setPending(out);
      setRemovePhoto(false);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "写真を読みこめませんでした");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit() {
    setSaving(true);
    try {
      let photoId: string | null | undefined;
      if (pending) photoId = (await savePhoto(db, pending)).id;
      else if (removePhoto) photoId = null;
      try {
        await saveFood(db, { ...f, genre, wantAgain, favorite, photoId }, id);
      } catch (e) {
        if (photoId) await db.photos.delete(photoId);
        throw e;
      }
      toast("保存しました");
      navigate("/food", { replace: true });
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fields);
      else if (e instanceof StorageLimitError) setPhotoError(e.message);
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={id ? "食事の記録を編集" : "美味しかったものを記録"} eyebrow="Food" back="/food">
      {dialog}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <TextField label="料理名" value={f.dishName} onChange={set("dishName")} maxLength={LIMITS.title} error={errors.dishName} placeholder="例:トマトとバジルのパスタ" />
        <TextField label="食べた日" type="date" value={f.date} onChange={set("date")} error={errors.date} />
        <Select label="ジャンル" value={genre} onChange={setGenre} options={GENRE_ORDER.map((g) => ({ value: g, label: GENRE_LABEL[g] }))} />
        <TextField label="お店の名前" optional value={f.restaurantName} onChange={set("restaurantName")} maxLength={LIMITS.short} />
        <TextField label="場所" optional value={f.location} onChange={set("location")} maxLength={LIMITS.short} hint="位置情報は自動で取得しません。必要なら手で入力してください。" />

        <div className="mb-4">
          <p className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink">
            写真 <span className="text-xs font-normal text-muted">任意</span>
          </p>
          {(pendingUrl || existingPhoto) && (
            <div className="mb-2 overflow-hidden rounded-2xl border border-line">
              {pendingUrl ? (
                <img src={pendingUrl} alt="選んだ写真のプレビュー" className="max-h-72 w-full object-cover" />
              ) : (
                existingPhoto && <PhotoView photoId={existingPhoto} alt={`${f.dishName}の写真`} className="max-h-72 w-full object-cover" />
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className={`${buttonClass("secondary", false, "sm")} cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary`}>
              <Camera aria-hidden size={16} />
              {pendingUrl || existingPhoto ? "写真を変える" : "写真を選ぶ"}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
                className="sr-only"
                onChange={(e) => void onPick(e.target.files?.[0])}
                data-testid="food-photo-input"
              />
            </label>
            {(pendingUrl || existingPhoto) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPending(null);
                  setRemovePhoto(true);
                }}
              >
                <ImageOff aria-hidden size={16} />
                写真を外す
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted" aria-live="polite">
            {processing
              ? "写真を縮小しています…"
              : pending
                ? `縮小済み:${pending.width}×${pending.height}・${formatBytes(pending.blob.size)}(位置情報などのメタデータは削除しました)`
                : "端末の中だけに保存します。保存時に縮小し、撮影場所などのメタデータを取り除きます。"}
          </p>
          {photoError && (
            <p role="alert" className="mt-1 text-xs font-medium text-danger">
              {photoError}
            </p>
          )}
        </div>

        <TextArea label="美味しかったポイント" optional value={f.highlights} onChange={set("highlights")} />
        <div className="mb-2 rounded-2xl border border-line bg-surface px-4 py-1">
          <Checkbox label="また食べたい" checked={wantAgain} onChange={setWantAgain} />
          <Checkbox label="お気に入り" checked={favorite} onChange={setFavorite} />
        </div>
        <div className="h-3" />
        <TextField label="誰と食べたか" optional value={f.companion} onChange={set("companion")} maxLength={LIMITS.short} />
        <TextArea label="メモ" optional value={f.notes} onChange={set("notes")} />
        {id && (
          <a href={href(`/share?kind=food&ids=${id}`)} className={`${buttonClass("soft", true)} mb-2`}>
            <Send aria-hidden size={18} />
            この料理のことを伝える
          </a>
        )}
        <Notice>共有文には料理名とお店の名前だけが入ります。写真・メモ・誰と食べたか・場所は入りません。</Notice>
        <FormActions
          saving={saving || processing}
          onCancel={() => goBack("/food")}
          onDelete={
            id
              ? async () => {
                  if (await ask("この記録を削除しますか？", "記録と写真をこの端末から削除します。元に戻せません。")) {
                    await deleteFood(db, id);
                    toast("削除しました");
                    navigate("/food", { replace: true });
                  }
                }
              : undefined
          }
        />
      </form>
    </Page>
  );
}
