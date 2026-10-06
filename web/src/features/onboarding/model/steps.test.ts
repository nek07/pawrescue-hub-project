import { describe, expect, it } from "vitest";
import { firstIncompleteStep, isDocumentType, profileSchema, whoSchema } from "./steps";

describe("firstIncompleteStep", () => {
  it("ведёт на первый шаг, где чего-то не хватает", () => {
    expect(firstIncompleteStep(["about", "registration"])).toBe("documents");
    expect(firstIncompleteStep(["contact_phone", "address"])).toBe("who");
    expect(firstIncompleteStep(["address"])).toBe("profile");
  });

  it("всё заполнено — сразу «Проверка»", () => {
    expect(firstIncompleteStep([])).toBe("review");
  });
});

describe("isDocumentType", () => {
  it("PDF — только для свидетельства", () => {
    expect(isDocumentType("registration", "application/pdf")).toBe(true);
    expect(isDocumentType("territory_photo", "application/pdf")).toBe(false);
    expect(isDocumentType("territory_photo", "image/webp")).toBe(false);
  });
});

describe("whoSchema", () => {
  const valid = {
    type: "shelter",
    name: " Тёплый угол ",
    city: "astana",
    phone: "8 701 234-56-78",
  };

  it("приводит телефон к +7 и обрезает пробелы", () => {
    expect(whoSchema.parse(valid)).toMatchObject({ name: "Тёплый угол", phone: "+77012345678" });
  });

  it("возвращает ключи перевода", () => {
    const result = whoSchema.safeParse({ ...valid, type: undefined, phone: "701" });
    const codes = result.error?.issues.map((i) => [i.path[0], i.message]);
    expect(codes).toEqual(
      expect.arrayContaining([
        ["type", "type_required"],
        ["phone", "phone_incomplete"],
      ]),
    );
  });
});

describe("profileSchema", () => {
  it("пустые поля превращает в null — так их очищают в PATCH", () => {
    expect(profileSchema.parse({ about: "  ", address: "", visitHours: "Сб 11–17" })).toEqual({
      about: null,
      address: null,
      visitHours: "Сб 11–17",
    });
  });
});
