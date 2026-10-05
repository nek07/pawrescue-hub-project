import { expect, test } from "@playwright/test";
import { applyAsNewUser, loginAs, noSeriousViolations, SEED } from "./helpers";

test("заявитель видит заявку в «Моих заявках» и может её отозвать", async ({ page }) => {
  await applyAsNewUser(page, SEED.aina);
  await page.getByRole("link", { name: "Мои заявки" }).click();

  const card = page.getByRole("listitem").filter({ hasText: "Айна" });
  await expect(card.getByText("Отправлена").first()).toBeVisible();
  await expect(card.getByRole("list", { name: "Ход заявки" })).toBeVisible();
  await noSeriousViolations(page);

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Отозвать заявку" }).click();
  await expect(card.getByText("Отозвана")).toBeVisible();
  await expect(card.getByRole("button", { name: "Отозвать заявку" })).toHaveCount(0);
});

test("обычный пользователь не видит входящих заявок", async ({ page }) => {
  await applyAsNewUser(page, SEED.aina);
  await page.goto("/ru/applications/incoming");
  await expect(page.getByRole("heading", { name: "Здесь заявки для кураторов" })).toBeVisible();
});

test("куратор приюта приглашает заявителя на знакомство", async ({ page }) => {
  const name = await applyAsNewUser(page, SEED.tykva);

  await loginAs(page, /Владелец приюта — Гульнара/);
  await page.goto("/ru/applications/incoming?status=sent");
  const card = page.getByRole("listitem").filter({ hasText: `От ${name}` });
  await expect(card).toBeVisible();
  // Телефон куратор видит только после одобрения
  await expect(card.getByText("Откроется после одобрения")).toBeVisible();
  await noSeriousViolations(page);

  await card.getByRole("button", { name: "Пригласить на знакомство" }).click();
  await expect(card.getByText("Знакомство").first()).toBeVisible();
  await expect(card.getByRole("button", { name: "Пригласить на знакомство" })).toHaveCount(0);
});
