import { execFileSync } from 'node:child_process';

/** ローカル Supabase の接続情報。ローカル以外なら止める(実データのある環境で E2E を走らせない) */
export function readLocalSupabase(): { url: string; anon: string; service: string; db: string } {
  const raw = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    cwd: new URL('../../..', import.meta.url).pathname,
  });
  const s = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  const url = s['API_URL'] ?? '';
  const db = s['DB_URL'] ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url) || !/@(127\.0\.0\.1|localhost):\d+\//.test(db)) {
    throw new Error('E2E runs only against a local Supabase stack');
  }
  return { url, anon: s['ANON_KEY'] ?? '', service: s['SERVICE_ROLE_KEY'] ?? '', db };
}
