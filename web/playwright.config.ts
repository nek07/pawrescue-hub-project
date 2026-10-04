import { defineConfig, devices } from "@playwright/test";

// Не 3000, чтобы не конфликтовать с запущенным `npm run dev`
const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
    // PW_CHANNEL=chrome — запуск в установленном Chrome, если браузеры Playwright не скачаны
    channel: process.env.PW_CHANNEL,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // 390px — ширина, на которой проверяем каждый экран
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  // Настоящий бэкенд: `docker compose up` в api/ и сид `python -m app.seed`
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${port}` : `npm run dev -- -p ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    env: {
      API_URL: process.env.API_URL ?? "http://localhost:8000",
      NEXT_PUBLIC_DEV_LOGIN: "1",
    },
  },
});
