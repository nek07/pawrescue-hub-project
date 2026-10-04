import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Chip } from "./chip";
import { Field } from "./field";
import { Input } from "./input";

describe("Button", () => {
  it("в состоянии loading заблокирована и не принимает повторное нажатие", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Отправляем…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Отправляем…" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("с asChild рендерит ссылку", () => {
    render(
      <Button asChild>
        <a href="#catalog">К каталогу</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "К каталогу" })).toHaveAttribute("href", "#catalog");
  });
});

describe("Field", () => {
  it("связывает подпись, подсказку и ошибку с полем", () => {
    render(
      <Field label="Телефон" hint="Увидит куратор" error="Номер неполный">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Телефон");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Номер неполный Увидит куратор");
  });

  it("без ошибки поле валидно", () => {
    render(
      <Field label="Имя">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Имя")).not.toHaveAttribute("aria-invalid");
  });
});

describe("Chip", () => {
  it("сообщает состояние через aria-pressed", () => {
    render(<Chip pressed>Кошки</Chip>);
    expect(screen.getByRole("button", { name: "Кошки" })).toHaveAttribute("aria-pressed", "true");
  });
});
