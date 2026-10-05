import { expect, test } from "@playwright/test";
import { devLogin, noSeriousViolations, SEED } from "./helpers";

const TOSHA = "Тоша уехал домой";

test("гость читает ленту, а отметки и комментарии ведут на вход", async ({ page }) => {
  const response = await page.goto("/ru/feed");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: TOSHA })).toBeVisible();
  await expect(page.getByText("Забрали питомца через платформу?")).toBeVisible();

  const post = page.getByRole("listitem").filter({ hasText: TOSHA }).first();
  await expect(post.getByRole("link", { name: /Нравится/ }).first()).toHaveAttribute(
    "href",
    /\/ru\/login\?next=%2Ffeed/,
  );
  await expect(post.getByText("Войдите, чтобы оставить комментарий").first()).toBeVisible();
  await noSeriousViolations(page);
});

test("вкладка «Нужна помощь» показывает только просьбы о помощи", async ({ page }) => {
  await page.goto("/ru/feed?category=help");
  await expect(page.getByRole("heading", { name: "Ветру нужна передержка" })).toBeVisible();
  await expect(page.getByRole("heading", { name: TOSHA })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Нужна помощь" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("вошедший ставит отметку, комментирует и отвечает", async ({ page }) => {
  await page.goto(`/ru/login?next=${encodeURIComponent("/feed")}`);
  await devLogin(page);
  await page.waitForURL(/\/ru\/feed$/);

  const post = page.getByRole("listitem").filter({ hasText: TOSHA }).first();
  const like = post.getByRole("button", { name: /^(Нравится|Убрать отметку) ·/ }).first();
  const pressed = await like.getAttribute("aria-pressed");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", pressed === "true" ? "false" : "true");

  const counter = post.getByText(/^\d+ комментари/).first();
  const before = Number((await counter.innerText()).match(/\d+/)![0]);
  const text = `e2e комментарий ${Date.now()}`;
  await post.getByLabel("Комментарий").last().fill(text);
  await post.getByRole("button", { name: "Отправить" }).last().click();
  await expect(post.getByText(text)).toBeVisible();
  await expect(counter).toContainText(String(before + 1));

  // Ответ — на один уровень под комментарием
  const comment = post.getByRole("listitem").filter({ hasText: text }).first();
  await comment.getByRole("button", { name: "Ответить" }).click();
  const reply = `e2e ответ ${Date.now()}`;
  await comment.getByLabel("Комментарий").fill(reply);
  await comment.getByRole("button", { name: "Отправить" }).click();
  await expect(comment.getByText(reply)).toBeVisible();
});

test("у приюта есть своя лента", async ({ page }) => {
  await page.goto(`/ru/shelters/${SEED.teplyiUgol}?tab=feed`);
  await expect(page.getByRole("heading", { name: TOSHA })).toBeVisible();
});
