import { defineConfig, devices } from '@playwright/test';
import { readLocalSupabase } from './tests/e2e/local-supabase.ts';

const sb = readLocalSupabase();

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'off',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: sb.url, VITE_SUPABASE_ANON_KEY: sb.anon },
  },
});
