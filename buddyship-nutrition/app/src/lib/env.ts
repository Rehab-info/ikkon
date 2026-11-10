import { z } from 'zod';

// フロントエンドに渡すのは公開前提の値だけ。service role キーなどはここに来てはいけない
const Env = z.object({
  // 開発時だけ 'same-origin' を許す:アプリと同じ URL を通して Vite の中継でローカルの Supabase につなぐ
  // (プレビュー画面など、ブラウザから 127.0.0.1:54321 に直接届かないとき用)。本番のビルドでは実際の URL を指定する
  VITE_SUPABASE_URL: import.meta.env.DEV ? z.union([z.url(), z.literal('same-origin')]) : z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(10),
});

const parsed = Env.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const env = {
  ...parsed,
  VITE_SUPABASE_URL: parsed.VITE_SUPABASE_URL === 'same-origin' ? window.location.origin : parsed.VITE_SUPABASE_URL,
};
