import { describe, expect, it } from "vitest";
import { getPetAge } from "./age";
import { countHiddenFilters, parsePetFilters, toPetSearchParams } from "./filters";

describe("parsePetFilters", () => {
  it("читает фильтры из URL", () => {
    expect(
      parsePetFilters({ kind: "cat", city: "astana", sterilized: "true", q: "  Мурка " }),
    ).toEqual({ kind: "cat", city: "astana", sterilized: true, q: "Мурка" });
  });

  it("город вне списка платформы игнорируется", () => {
    expect(parsePetFilters({ city: "pavlodar" })).toEqual({});
  });

  it("игнорирует мусор вместо падения страницы", () => {
    expect(
      parsePetFilters({ kind: "hamster", city: "", sterilized: "yes", limit: "100000", q: "" }),
    ).toEqual({});
  });

  it("берёт первое значение из повторяющегося параметра", () => {
    expect(parsePetFilters({ age: ["lt1", "gt5"] })).toEqual({ age: "lt1" });
  });
});

describe("toPetSearchParams", () => {
  it("не пишет значения по умолчанию", () => {
    expect(toPetSearchParams({ sort: "new", limit: 24, kind: "dog" }).toString()).toBe("kind=dog");
  });

  it("переживает круг URL → фильтры → URL", () => {
    const query = "kind=cat&age=1to5&city=astana&good_with_kids=true&sort=old&limit=48";
    const filters = parsePetFilters(Object.fromEntries(new URLSearchParams(query)));
    expect(toPetSearchParams(filters).toString()).toBe(query);
  });
});

describe("countHiddenFilters", () => {
  it("считает фильтры под кнопкой «Фильтры», без поиска и города", () => {
    expect(countHiddenFilters({ kind: "cat", needs_foster: true, city: "astana", q: "x" })).toBe(2);
  });
});

describe("getPetAge", () => {
  const now = new Date("2026-10-04");

  it("до года — в месяцах", () => {
    expect(getPetAge("2026-03-01", now)).toEqual({ unit: "months", count: 7 });
  });

  it("новорождённому — минимум месяц", () => {
    expect(getPetAge("2026-09-30", now)).toEqual({ unit: "months", count: 1 });
  });

  it("после года — в полных годах", () => {
    expect(getPetAge("2022-10-05", now)).toEqual({ unit: "years", count: 3 });
    expect(getPetAge("2022-10-04", now)).toEqual({ unit: "years", count: 4 });
  });
});
