import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("кастомный радиус из токенов перекрывает стандартный", () => {
    expect(cn("rounded-sm px-3", "rounded-pill")).toBe("px-3 rounded-pill");
  });
});
