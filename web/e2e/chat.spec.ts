import { expect, test } from "@playwright/test";
import { devLogin, loginAs, noSeriousViolations, SEED } from "./helpers";

test("гость: «Спросить куратора» ведёт на вход", async ({ page }) => {
  await page.goto(`/ru/pets/${SEED.murka}`);
  await expect(page.getByRole("link", { name: /Спросить куратора/ })).toHaveAttribute(
    "href",
    new RegExp(`/ru/login\\?next=%2Fpets%2F${SEED.murka}`),
  );
});

test("пользователь пишет куратору о питомце, куратор отвечает", async ({ browser }) => {
  // Два человека — два браузера
  const user = await (await browser.newContext()).newPage();
  await user.goto(`/ru/login?next=${encodeURIComponent(`/pets/${SEED.murka}`)}`);
  const name = await devLogin(user);
  await user.waitForURL(new RegExp(`/ru/pets/${SEED.murka}$`));

  await user
    .getByRole("button", { name: /Спросить куратора/ })
    .first()
    .click();
  await user.waitForURL(/\/ru\/messages\/[\w-]+$/);
  const question = `Мурка ещё ищет дом? ${Date.now()}`;
  await user.getByLabel("Сообщение", { exact: true }).fill(question);
  await user.keyboard.press("Enter");
  await expect(user.getByText(question)).toBeVisible();
  await noSeriousViolations(user);

  const curator = await (await browser.newContext()).newPage();
  await loginAs(curator, /Владелец приюта — Гульнара/);
  await curator.goto("/ru/messages");
  await curator
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(curator.getByText(question)).toBeVisible();
  const answer = `Да, приходите в субботу ${Date.now()}`;
  await curator.getByLabel("Сообщение", { exact: true }).fill(answer);
  await curator.getByRole("button", { name: "Отправить" }).click();
  await expect(curator.getByText(answer)).toBeVisible();

  // Сокет может быть недоступен (Origin), тогда ответ приходит опросом REST
  await expect(user.getByText(answer)).toBeVisible({ timeout: 15_000 });
});

test("чужая или несуществующая беседа — 404", async ({ page }) => {
  await page.goto(`/ru/login?next=${encodeURIComponent("/messages")}`);
  await devLogin(page);
  await page.waitForURL(/\/ru\/messages$/);
  const response = await page.goto("/ru/messages/00000000-0000-0000-0000-000000000000");
  expect(response?.status()).toBe(404);
});
