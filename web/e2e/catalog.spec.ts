import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("фильтр по виду меняет URL и выдачу и переживает перезагрузку", async ({ page, isMobile }) => {
  await page.goto("/ru/pets");
  await expect(page.getByText(/Найдено: 14 питомцев/)).toBeVisible();

  if (isMobile) await page.getByRole("button", { name: /Фильтры/ }).click();
  await page.getByRole("button", { name: "Собаки" }).click();

  await expect(page).toHaveURL(/kind=dog/);
  await expect(page.getByText(/Найдено: 5 питомцев/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Собаки" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.reload();
  await expect(page.getByText(/Найдено: 5 питомцев/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Лорд", exact: true })).toBeVisible();
});

test("пустая выдача предлагает сбросить фильтры", async ({ page }) => {
  await page.goto("/ru/pets?city=astana&kind=cat");
  await expect(page.getByRole("heading", { name: "Никого не нашли" })).toBeVisible();
  await page.getByRole("link", { name: "Сбросить фильтры" }).click();
  await expect(page).toHaveURL(/\/ru\/pets$/);
  await expect(page.getByText(/Найдено: 14 питомцев/)).toBeVisible();
});

test("главная: кнопки hero и раздел историй", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Истории, которые заканчиваются дома",
  );
  await expect(page.getByRole("heading", { name: "Тоша уехал домой" })).toBeVisible();
  // Платформа работает только в Астане — других городов в интерфейсе нет
  await expect(page.getByText("Павлодар")).toHaveCount(0);

  await page.getByRole("link", { name: "Читать истории" }).click();
  await expect(page).toHaveURL(/\/ru\/feed$/);
  await page.goto("/ru");
  await page.getByRole("link", { name: "Найти питомца" }).click();
  await expect(page).toHaveURL(/\/ru\/pets$/);
});

test("анкеты на казахском и без серьёзных нарушений доступности", async ({ page }) => {
  await page.goto("/kk/pets");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Үй іздеп жүрген жануарлар");
  await expect(page.getByText("Табылды: 14 жануар")).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});
