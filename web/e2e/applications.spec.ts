import { expect, test } from "@playwright/test";
import { applyAsNewUser, devLogin, loginAs, noSeriousViolations, SEED } from "./helpers";

test("заявитель видит заявку в «Моих заявках» и может её отозвать", async ({ page }) => {
  await applyAsNewUser(page, SEED.aina);
  await page.goto("/ru/applications");

  const card = page.getByRole("listitem").filter({ hasText: "Айна" });
  await expect(card.locator('[aria-current="step"]')).toHaveText("Отправлена");
  await expect(card.getByRole("list", { name: "Ход заявки" })).toBeVisible();
  await noSeriousViolations(page);

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Отозвать заявку" }).click();
  await expect(card.getByText("Отозвана")).toBeVisible();
  await expect(card.getByRole("button", { name: "Отозвать заявку" })).toHaveCount(0);
});

test("обычный пользователь не видит входящих заявок", async ({ page }) => {
  await page.goto(`/ru/login?next=${encodeURIComponent("/applications/incoming")}`);
  await devLogin(page);
  await expect(page.getByRole("heading", { name: "Здесь заявки для кураторов" })).toBeVisible();
});

test("куратор приюта приглашает заявителя на знакомство", async ({ page }) => {
  const name = await applyAsNewUser(page, SEED.tykva);

  await loginAs(page, /Владелец приюта — Гульнара/);
  // Без фильтра: после приглашения заявка уйдёт из «Отправлена», а нам нужна та же карточка
  await page.goto("/ru/applications/incoming");
  const card = page.getByRole("listitem").filter({ hasText: `От ${name}` });
  await expect(card).toBeVisible();
  // Телефон куратор видит только после одобрения
  await expect(card.getByText("Откроется после одобрения")).toBeVisible();
  await noSeriousViolations(page);

  await card.getByRole("button", { name: "Пригласить на знакомство" }).click();
  await expect(card.locator('[aria-current="step"]')).toHaveText("Знакомство");
  await expect(card.getByRole("button", { name: "Пригласить на знакомство" })).toHaveCount(0);

  // Убираем за собой: отклонённая заявка не копится во «Входящих» у Гульнары
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Отклонить" }).click();
  await expect(card.getByText("Отклонена").first()).toBeVisible();
});
