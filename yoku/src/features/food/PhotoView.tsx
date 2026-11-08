import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";

export function useObjectUrl(blob: Blob | undefined | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function PhotoView({ photoId, alt, className }: { photoId: string; alt: string; className?: string }) {
  const { db } = useApp();
  const [blob, setBlob] = useState<Blob>();
  useEffect(() => {
    let alive = true;
    void db.photos.get(photoId).then((p) => alive && setBlob(p?.blob));
    return () => {
      alive = false;
    };
  }, [db, photoId]);
  const url = useObjectUrl(blob);
  if (!url) return <div className={`${className ?? ""} bg-surface-2`} aria-hidden />;
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}
