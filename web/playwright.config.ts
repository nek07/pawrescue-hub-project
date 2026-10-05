import { defineConfig, devices } from "@playwright/test";

// Не 3000, чтобы не конфликтовать с запущенным `npm run dev`
const port = 3100;

const desktop = { ...devices["Desktop Chrome"] };
const mobile = { ...devices["iPhone 13"], defaultBrowserType: "chromium" as const };
/** Спеки, которые меняют общий каталог (создают и публикуют анкеты) */
const MUTATES_CATALOG = /cabinet\.spec\.ts/;

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
    { name: "desktop", use: desktop, testIgnore: MUTATES_CATALOG },
    // 390px — ширина, на которой проверяем каждый экран
    { name: "mobile", use: mobile, testIgnore: MUTATES_CATALOG },
    // Спеки, которые публикуют анкеты, — после остальных: тесты каталога считают
    // питомцев точно («Найдено: 14») и не должны видеть временную анкету
    {
      name: "desktop-catalog-writes",
      use: desktop,
      testMatch: MUTATES_CATALOG,
      dependencies: ["desktop", "mobile"],
    },
    {
      name: "mobile-catalog-writes",
      use: mobile,
      testMatch: MUTATES_CATALOG,
      dependencies: ["desktop", "mobile"],
    },
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
