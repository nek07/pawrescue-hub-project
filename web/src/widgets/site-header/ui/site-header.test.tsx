import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/ru.json";
import { SiteHeader } from "./site-header";

// Server action: в Next клиент получает только ссылку на неё, Vitest же исполнил бы модуль
vi.mock("@/features/logout", () => ({ logout: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ru/pets",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

function renderHeader(user: Parameters<typeof SiteHeader>[0]["user"]) {
  return render(
    <NextIntlClientProvider locale="ru" messages={messages}>
      <SiteHeader user={user} />
    </NextIntlClientProvider>,
  );
}

describe("SiteHeader", () => {
  it("гостю показывает «Войти» и не показывает сообщения", () => {
    renderHeader(null);
    expect(screen.getByRole("link", { name: "Войти" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Сообщения" })).not.toBeInTheDocument();
  });

  it("вошедшему показывает сообщения и аватар", () => {
    renderHeader({
      id: "1",
      name: "Асель",
      role: "user",
      city: null,
      avatar_url: null,
      verified: false,
    });
    expect(screen.queryByRole("link", { name: "Войти" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сообщения" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Меню профиля" })).toBeInTheDocument();
  });

  it("подсвечивает текущий раздел", () => {
    renderHeader(null);
    expect(screen.getByRole("link", { name: "Питомцы" })).toHaveAttribute("aria-current", "page");
  });
});
