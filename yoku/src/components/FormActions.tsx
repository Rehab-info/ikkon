import { Trash2 } from "lucide-react";
import { Button } from "./ui";

export function FormActions({ saving, onCancel, onDelete, submitLabel = "保存する" }: { saving: boolean; onCancel: () => void; onDelete?: () => void; submitLabel?: string }) {
  return (
    <div className="mt-6 flex flex-col gap-2">
      <Button type="submit" full disabled={saving}>
        {submitLabel}
      </Button>
      <Button variant="ghost" full onClick={onCancel}>
        やめる
      </Button>
      {onDelete && (
        <Button variant="ghost" full onClick={onDelete} className="mt-4 text-danger hover:bg-danger-soft">
          <Trash2 aria-hidden size={18} />
          この記録を削除
        </Button>
      )}
    </div>
  );
}
