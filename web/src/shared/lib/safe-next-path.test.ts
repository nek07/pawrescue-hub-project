import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("пропускает относительный путь с параметрами", () => {
    expect(safeNextPath("/pets/murka/apply?x=1")).toBe("/pets/murka/apply?x=1");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "pets", undefined, ["/a"]])(
    "отбрасывает %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );
});
