#!/usr/bin/env node
/**
 * 秘密情報の混入と service role の使用箇所を検査する(SECURITY §4・§10、CI で実行)
 *  1. フロントエンドのビルド成果物(app/dist)に service role キー・秘密鍵の書式がない
 *  2. service role を参照してよいファイルは許可リストのものだけ
 *  3. リポジトリに .env などの秘密ファイルが追跡されていない
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const problems = [];

// 1. ビルド成果物
const SECRET_PATTERNS = [
  [/service_role/i, 'service_role'],
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'Supabase secret key'],
  [/sk-ant-[A-Za-z0-9_-]{10,}/, 'Anthropic API key'],
  [/sk-[A-Za-z0-9]{32,}/, 'API secret key'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
];
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const dist = join(root, 'app/dist');
if (existsSync(dist)) {
  for (const file of walk(dist)) {
    const text = readFileSync(file, 'utf8');
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(text)) problems.push(`${relative(root, file)}: build output contains ${label}`);
    }
    // anon key は公開前提だが、role が anon 以外の JWT が入っていないか確かめる
    for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload.role !== 'anon')
        problems.push(`${relative(root, file)}: build output contains a JWT with role=${payload.role}`);
    }
  }
} else {
  console.log('app/dist not found: build output check skipped');
}

// 2. service role の参照箇所
const ALLOWED = new Set([
  'supabase/functions/_shared/service-client.ts',
  'scripts/check-secrets.mjs',
  'scripts/seed-dev-users.mjs',
  'tests/integration/global-setup.ts',
  'tests/integration/helpers.ts',
  'app/tests/e2e/local-supabase.ts',
  'app/tests/e2e/global-setup.ts',
  'eslint.config.js',
  'supabase/config.toml', // CLI が生成した説明コメントのみ(キーは含まない)
]);
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '.'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => /\.(ts|tsx|js|mjs|json|toml|sql)$/.test(f));
for (const file of tracked) {
  const text = readFileSync(join(root, file), 'utf8');
  if (
    /SERVICE_ROLE|service_role/.test(text) &&
    !ALLOWED.has(file) &&
    !file.startsWith('docs/') &&
    !file.endsWith('.sql')
  ) {
    problems.push(`${file}: references the service role but is not in the allow-list`);
  }
  if (
    /createServiceClient\(/.test(text) &&
    ![
      'supabase/functions/_shared/service-client.ts',
      'supabase/functions/admin-invite-user/index.ts',
      'supabase/functions/purge-expired-images/index.ts',
    ].includes(file)
  ) {
    problems.push(`${file}: uses createServiceClient but is not an approved function (ARCHITECTURE §4.3)`);
  }
}

// 3. 秘密ファイル
const all = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '.'], {
  cwd: root,
  encoding: 'utf8',
}).split('\n');
for (const f of all) {
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) problems.push(`${f}: secret file would be committed`);
  if (/\.(pem|key|p12|crt)$/.test(f)) problems.push(`${f}: key/certificate file would be committed`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('check-secrets: ok');
