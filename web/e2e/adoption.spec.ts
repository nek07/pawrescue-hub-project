import { expect, test } from "@playwright/test";
import { devLogin, noSeriousViolations, SEED } from "./helpers";

test("каталог → питомец → вход → заявка → сообщения", async ({ page }) => {
  await page.goto("/ru/pets");
  await page.getByRole("link", { name: "Мурка" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Мурка" })).toBeVisible();
  await expect(page.getByText("Её нашли у подъезда в феврале")).toBeVisible();
  // При клиентском переходе Next подставляет <title> чуть позже содержимого
  await expect(page).toHaveTitle("Мурка — Paw Rescue Hub");
  await noSeriousViolations(page);

  // Гость видит кнопку, но попадает на вход с возвратом обратно
  await page.getByRole("link", { name: "Хочу забрать домой" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fpets%2F[\w-]+%2Fapply/);
  const name = await devLogin(page);

  await expect(page).toHaveURL(`/ru/pets/${SEED.murka}/apply`);
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue(name);
  await expect(page.getByLabel("Город")).toHaveValue("pavlodar");

  // Ошибки — под полями, как на листе «Состояния»
  await page.getByLabel("Телефон").fill("+7 701 23");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Номер неполный: нужно 11 цифр")).toBeVisible();
  await expect(page.getByLabel("Телефон")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Выберите тип жилья")).toBeVisible();
  await noSeriousViolations(page);

  await page.getByLabel("Телефон").fill("8 701 234 56 78");
  await page.getByLabel("Квартира").check();
  await page.getByLabel("Дети").check();
  await page.getByLabel(/Соглашаюсь, что куратор свяжется со мной/).check();
  await page.getByRole("button", { name: "Отправить заявку" }).click();

  await expect(page).toHaveURL(`/ru/messages?sent=${SEED.murka}`);
  await expect(page.getByRole("status")).toContainText("Заявка отправлена: Мурка");

  // Повторная заявка на того же питомца — ошибка бэкенда над кнопкой
  await page.goto(`/ru/pets/${SEED.murka}/apply`);
  await page.getByLabel("Телефон").fill("+7 701 234 56 78");
  await page.getByLabel("Квартира").check();
  await page.getByLabel(/Соглашаюсь, что куратор свяжется со мной/).check();
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Вы уже отправили заявку на этого питомца" }),
  ).toBeVisible();
});

test("питомец на лечении: кнопка недоступна, причина рядом", async ({ page, isMobile }) => {
  test.skip(isMobile, "кнопка в карточке видна на десктопе");
  await page.goto(`/ru/pets/${SEED.graf}`);
  const apply = page.getByRole("button", { name: "Хочу забрать домой" });
  await expect(apply).toBeDisabled();
  await expect(apply).toHaveAccessibleDescription("Заявки на этого питомца больше не принимаются.");
});

test("снятая анкета — 404 со ссылкой в каталог", async ({ page }) => {
  for (const path of ["/ru/pets/net-takogo", "/ru/pets/00000000-0000-0000-0000-000000000000"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Такой страницы нет" })).toBeVisible();
  }
});

test("закрытая страница без входа ведёт на вход", async ({ page }) => {
  await page.goto("/kk/messages");
  await expect(page).toHaveURL(/\/kk\/login\?next=%2Fmessages/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Жануарды үйге алу үшін кіріңіз",
  );
});

test("next с чужим доменом не уводит с сайта", async ({ page }) => {
  await page.goto("/ru/login?next=https://evil.example");
  await expect(page.getByRole("link", { name: "Войти через Google" })).toHaveAttribute(
    "href",
    "/api/v1/auth/google/login?next=%2Fru",
  );
});

test("ошибка входа через Google видна на странице входа", async ({ page }) => {
  await page.goto("/login?error=google_failed");
  await expect(
    page.getByRole("alert").filter({ hasText: "Не получилось войти через Google" }),
  ).toBeVisible();
});

test("выход из аккаунта через меню аватара", async ({ page, isMobile }) => {
  test.skip(isMobile, "меню аватара — в шапке на десктопе");
  await page.goto("/ru/login");
  await devLogin(page);
  await expect(page).toHaveURL(/\/ru$/);

  // Сразу после редиректа меню может быть ещё не гидратировано — повторяем клик
  const logout = page.getByRole("menuitem", { name: "Выйти" });
  await expect(async () => {
    await page.getByRole("button", { name: "Меню профиля" }).click();
    await expect(logout).toBeVisible({ timeout: 1000 });
  }).toPass();
  await logout.click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Войти" })).toBeVisible();
});

test("приюты: фильтр по типу и профиль с вкладками", async ({ page }) => {
  await page.goto("/ru/shelters");
  await expect(page.getByText(/Найдено: 6 участников/)).toBeVisible();
  await page.getByLabel("Тип").selectOption("volunteer");
  await expect(page).toHaveURL(/type=volunteer/);
  await expect(page.getByText(/Найдено: 3 участника/)).toBeVisible();

  // У волонтёра нет своей страницы — карточка ведёт в каталог его питомцев
  await page.getByRole("link", { name: "Асем" }).click();
  await expect(page).toHaveURL(/\/ru\/pets\?volunteer_id=/);
  await expect(page.getByRole("link", { name: "Снежок" })).toBeVisible();

  await page.goto(`/ru/shelters/${SEED.teplyiUgol}`);
  await expect(page.getByRole("heading", { level: 1, name: "«Тёплый угол»" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Мурка" })).toBeVisible();
  await page.getByRole("link", { name: "О приюте" }).click();
  await expect(page).toHaveURL(/tab=about/);
  await expect(page.getByText("Павлодар, ул. Луговая, 16")).toBeVisible();
  await noSeriousViolations(page);
});
