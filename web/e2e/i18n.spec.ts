import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("корень редиректит на русскую версию", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("казахская версия отдаёт lang=kk и казахский текст", async ({ page }) => {
  await page.goto("/kk");
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Үйде аяқталатын оқиғалар");
});

test("главная без нарушений доступности уровня serious", async ({ page }) => {
  await page.goto("/ru");
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious).toEqual([]);
});
