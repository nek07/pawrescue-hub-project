import path from "node:path";
import { expect, test } from "@playwright/test";
import { devLogin, loginAs, noSeriousViolations } from "./helpers";

const PHOTO = path.join(__dirname, "fixtures", "pet.jpg");

test("гость: кабинет только после входа", async ({ page }) => {
  await page.goto("/ru/cabinet");
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fcabinet/);
});

test("обычный пользователь видит, что кабинет — для кураторов", async ({ page }) => {
  await page.goto("/ru/login");
  await devLogin(page);
  await page.goto("/ru/cabinet");
  await expect(page.getByText("Кабинет — для приютов и волонтёров")).toBeVisible();
});

test("приют создаёт анкету, добавляет фото и публикует её", async ({ page }) => {
  test.slow(); // загрузка и обработка фото воркером
  const name = `Лиса ${Date.now().toString(36)}`;

  await loginAs(page, /Владелец приюта — Гульнара/);
  await page.goto("/ru/cabinet");
  await expect(page.getByRole("heading", { level: 1, name: "Кабинет куратора" })).toBeVisible();
  await noSeriousViolations(page);

  await page.getByRole("link", { name: "Новая анкета" }).click();
  await page.waitForURL(/\/ru\/cabinet\/pets\/new$/);
  await page.getByLabel("Кличка").fill(name);
  await page.getByLabel("Кот / Кошка").check();
  await page.getByLabel("Девочка").check();
  await page.getByLabel("Дата рождения").fill("2024-04-01");
  await page.getByLabel(/^спокойная$/).check();
  await page.getByLabel("История", { exact: true }).fill("Нашли во дворе, очень ласковая.");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await page.waitForURL(/\/ru\/cabinet\/pets\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  // Без фото опубликовать нельзя — и понятно, чего не хватает
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText("Не хватает: фото.")).toBeVisible();

  await page.getByLabel("Добавить фото").setInputFiles(PHOTO);
  await expect(page.getByRole("img", { name: "Фото 1" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Обложка", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByRole("link", { name: /Открыть анкету/ })).toBeVisible();

  await page.goto(`/ru/pets?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
});
