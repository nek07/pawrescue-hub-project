import { describe, expect, it } from "vitest";
import kk from "../../../messages/kk.json";
import ru from "../../../messages/ru.json";
import { mergeMessages } from "./merge-messages";

describe("mergeMessages", () => {
  it("берёт перевод, а недостающие ключи оставляет русскими", () => {
    const base = { a: "А", nested: { b: "Б", c: "В" } };
    const override = { a: "A", nested: { b: "B" } };

    expect(mergeMessages(base, override)).toEqual({
      messages: { a: "A", nested: { b: "B", c: "В" } },
      missing: ["nested.c"],
    });
  });

  it("в kk.json есть все ключи из ru.json", () => {
    expect(mergeMessages(ru, kk).missing).toEqual([]);
  });
});
