import { describe, expect, it } from "vitest";
import { isPhotoType, movePhoto } from "./limits";

describe("movePhoto", () => {
  it("делает фото обложкой и двигает соседей", () => {
    expect(movePhoto(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(movePhoto(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
    expect(movePhoto(["a", "b", "c"], "b", 9)).toEqual(["a", "c", "b"]);
  });
});

describe("isPhotoType", () => {
  it("пропускает только то, что умеет воркер", () => {
    expect(isPhotoType("image/webp")).toBe(true);
    expect(isPhotoType("image/gif")).toBe(false);
  });
});
