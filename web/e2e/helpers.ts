import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** id из сид-данных бэкенда (api/src/app/seed.py) — детерминированные uuid5 */
export const SEED = {
  murka: "7292aa9c-e54b-5d12-b100-28d8940ab0f6",
  graf: "13000a07-1f13-59da-be1b-93049419d3dd",
  aina: "aeffd699-a171-58fa-8a3b-d5e2eb0ec436",
  tykva: "12f9be45-5d04-57ad-bdf0-5325bad8e8b0",
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

/**
 * Dev-вход бэкенда (/auth/dev-login) со страницы входа. Бэкенд пускает не больше
 * 20 входов в минуту с одного IP — при 429 ждём, сколько он сказал, и повторяем.
 */
export async function devLogin(page: Page, name = uniqueName()) {
  const loginUrl = page.url();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel("Или новый пользователь с именем").fill(name);
    await page.getByRole("button", { name: "Войти новым пользователем" }).click();
    const tooMany = page.getByRole("alert").filter({ hasText: "Слишком много входов подряд" });
    const left = await Promise.race([
      page.waitForURL((url) => url.href !== loginUrl, { timeout: 15_000 }).then(() => true),
      tooMany.waitFor({ timeout: 15_000 }).then(() => false),
    ]);
    if (left) return name;
    const seconds = Number((await tooMany.innerText()).match(/(\d+)\s*с/)?.[1] ?? 60);
    await page.waitForTimeout((seconds + 1) * 1000);
  }
  throw new Error("dev-login: бэкенд продолжает отвечать 429");
}

/** Сид-аккаунт кнопкой из блока dev-входа: «Владелец приюта — Гульнара…» и т.п. */
export async function loginAs(page: Page, button: RegExp) {
  await page.goto("/ru/login");
  await page.getByRole("button", { name: button }).click();
  await page.waitForURL(/\/ru$/);
}

/** Новый пользователь подаёт заявку на питомца; возвращает его имя */
export async function applyAsNewUser(page: Page, petId: string) {
  await page.goto(`/ru/login?next=${encodeURIComponent(`/pets/${petId}/apply`)}`);
  const name = await devLogin(page);
  await page.waitForURL(`**/ru/pets/${petId}/apply`);
  await page.getByLabel("Телефон").fill("+7 701 234 56 78");
  await page.getByLabel("Квартира").check();
  await page.getByLabel(/Соглашаюсь, что куратор свяжется со мной/).check();
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await page.waitForURL(/\/ru\/messages(\/[\w-]+|\?sent=)/);
  return name;
}
