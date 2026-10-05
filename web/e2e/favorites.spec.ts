import { expect, test } from "@playwright/test";
import { devLogin, SEED } from "./helpers";

test("гость видит сердечко, но оно ведёт на вход", async ({ page }) => {
  await page.goto("/ru/pets");
  await expect(page.getByRole("link", { name: "Добавить Мурка в избранное" })).toHaveAttribute(
    "href",
    /\/ru\/login\?next=%2Fpets/,
  );
});

test("питомец из анкет попадает в «Избранное» и убирается оттуда", async ({ page }) => {
  await page.goto(`/ru/login?next=${encodeURIComponent("/pets")}`);
  await devLogin(page);
  await page.waitForURL(/\/ru\/pets$/);

  await page.getByRole("button", { name: "Добавить Айна в избранное" }).click();
  await expect(page.getByRole("button", { name: "Убрать Айна из избранного" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto("/ru/favorites");
  await expect(page.getByRole("link", { name: "Айна", exact: true })).toBeVisible();

  // На странице питомца — та же отметка, снимаем её
  await page.goto(`/ru/pets/${SEED.aina}`);
  const saved = page.getByRole("button", { name: "В избранном" });
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await saved.click();
  await expect(page.getByRole("button", { name: "В избранное" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.goto("/ru/favorites");
  await expect(page.getByText("Пока никого в избранном")).toBeVisible();
});

test("подписка на приют увеличивает счётчик и видна в «Избранном»", async ({ page }) => {
  await page.goto(`/ru/login?next=${encodeURIComponent(`/shelters/${SEED.teplyiUgol}`)}`);
  await devLogin(page);
  await page.waitForURL(/\/ru\/shelters\//);

  const followers = page.locator("dl div").filter({ hasText: "Подписчики" }).locator("dd");
  const before = Number((await followers.innerText()).replace(/\D/g, ""));
  await page.getByRole("button", { name: "Подписаться" }).click();
  await expect(page.getByRole("button", { name: "Вы подписаны" })).toBeVisible();
  await expect(followers).toHaveText(String(before + 1).replace(/\B(?=(\d{3})+$)/g, " "));

  await page.goto("/ru/favorites");
  await expect(page.getByRole("link", { name: "«Тёплый угол»" })).toBeVisible();

  // Убираем за собой
  await page.goto(`/ru/shelters/${SEED.teplyiUgol}`);
  await page.getByRole("button", { name: "Вы подписаны" }).click();
  await expect(page.getByRole("button", { name: "Подписаться" })).toBeVisible();
});
