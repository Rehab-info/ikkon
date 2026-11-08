import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:4173/",
    trace: "off",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo"
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173/",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
