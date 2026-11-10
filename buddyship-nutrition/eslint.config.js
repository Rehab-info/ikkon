import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dev-dist/**',
      '**/node_modules/**',
      'supabase/functions/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // ログはサーバー側の許可キー方式ロガーだけ。画面のコードに console を残さない(SECURITY §8)
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'XSS 対策のため dangerouslySetInnerHTML は使わない(SECURITY T16)',
        },
        {
          selector: 'Literal[value=/service_role|SERVICE_ROLE/]',
          message: 'service role はフロントエンド・共有コードで扱わない(SECURITY §4)',
        },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    // テスト・テスト用の設定はローカルの接続情報を扱う
    files: ['tests/**/*.ts', 'app/tests/**/*.ts', 'app/playwright.config.ts', '**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-syntax': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // 開発・CI 用のスクリプト(Node で実行。結果を標準出力に出す)
    files: ['scripts/**/*.mjs', '*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
);
