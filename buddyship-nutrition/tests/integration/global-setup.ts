import { execFileSync } from 'node:child_process';

/**
 * `supabase status` からローカルの接続情報を読む。ローカル以外には絶対に接続しない
 * (実利用者データのある環境でテストを走らせないため)。
 */
export default function setup(): void {
  const raw = execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
  const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  const url = status['API_URL'] ?? '';
  const db = status['DB_URL'] ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url) || !/@(127\.0\.0\.1|localhost):\d+\//.test(db)) {
    throw new Error('Integration tests run only against a local Supabase stack');
  }
  process.env['IT_SUPABASE_URL'] = url;
  process.env['IT_ANON_KEY'] = status['ANON_KEY'] ?? '';
  process.env['IT_SERVICE_ROLE_KEY'] = status['SERVICE_ROLE_KEY'] ?? '';
  process.env['IT_DB_URL'] = db;
  process.env['IT_FUNCTIONS_URL'] = `${url}/functions/v1`;
}
