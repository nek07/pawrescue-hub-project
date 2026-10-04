import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** id из сид-данных бэкенда (api/src/app/seed.py) — детерминированные uuid5 */
export const SEED = {
  murka: "7292aa9c-e54b-5d12-b100-28d8940ab0f6",
  graf: "13000a07-1f13-59da-be1b-93049419d3dd",
  teplyiUgol: "ef065e41-32a7-53dd-b4ba-e744c9f7ea67",
};

export async function noSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}

/** Новый пользователь на каждый вход — повторные прогоны не упираются в application_exists */
export function uniqueName() {
  return `Тест ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Dev-вход бэкенда (/auth/dev-login) со страницы входа */
export async function devLogin(page: Page, name = uniqueName()) {
  await page.getByLabel("Или новый пользователь с именем").fill(name);
  await page.getByRole("button", { name: "Войти новым пользователем" }).click();
  return name;
}
