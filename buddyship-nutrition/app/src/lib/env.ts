import { z } from 'zod';

// フロントエンドに渡すのは公開前提の値だけ。service role キーなどはここに来てはいけない
const Env = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(10),
});

export const env = Env.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
