import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("неизвестный адрес показывает локализованную 404", async ({ page }) => {
  const response = await page.goto("/kk/net-takoi-stranicy");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Мұндай бет жоқ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Барлық жануарлар" })).toHaveAttribute(
    "href",
    "/kk/pets",
  );

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("гость видит «Войти»: в шапке на десктопе, во вкладках на телефоне", async ({
  page,
  isMobile,
}) => {
  await page.goto("/ru");
  const nav = isMobile
    ? page.getByRole("navigation", { name: "Разделы" })
    : page.getByRole("banner");
  await expect(nav.getByRole("link", { name: "Войти" })).toBeVisible();
});

test("переключатель языка ведёт на ту же страницу", async ({ page }) => {
  await page.goto("/ru");
  await page.getByRole("link", { name: "Қазақша" }).click();
  await expect(page).toHaveURL(/\/kk$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
});

test("первый Tab — ссылка «Перейти к содержимому»", async ({ page, isMobile }) => {
  test.skip(isMobile, "клавиатура проверяется на десктопе");
  await page.goto("/ru");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Перейти к содержимому" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

test("на телефоне нет горизонтальной прокрутки", async ({ page, isMobile }) => {
  test.skip(!isMobile, "проверяется на ширине 390px");
  for (const path of ["/ru", "/ru/pets", "/ru/feed", "/ru/shelters", "/kk/feed"]) {
    await page.goto(path);
    const [scroll, viewport] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scroll, path).toBeLessThanOrEqual(viewport);
  }
});
