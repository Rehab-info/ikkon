import { defineConfig } from 'vitest/config';

// ローカル Supabase(supabase start)に対する結合テスト。順番に実行する
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
