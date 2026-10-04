import { describe, expect, it } from "vitest";
import { applySchema, normalizePhone } from "./schema";

const valid = {
  petId: "murka",
  name: "Асель",
  phone: "+7 701 234 56 78",
  city: "pavlodar",
  housing: "flat",
  household: ["kids"],
  about: "",
  consent: true,
} as const;

const errorsOf = (input: unknown) => {
  const result = applySchema.safeParse(input);
  return result.success ? {} : result.error.flatten().fieldErrors;
};

describe("normalizePhone", () => {
  it.each([
    ["+7 701 234 56 78", "+77012345678"],
    ["8 (701) 234-56-78", "+77012345678"],
    ["+7 701 23", "+770123"],
  ])("%s → %s", (input, output) => {
    expect(normalizePhone(input)).toBe(output);
  });
});

describe("applySchema", () => {
  it("принимает заполненную анкету и нормализует телефон", () => {
    const result = applySchema.parse(valid);
    expect(result.phone).toBe("+77012345678");
  });

  it("неполный номер — ключ phone_incomplete, как в макете", () => {
    expect(errorsOf({ ...valid, phone: "+7 701 23" }).phone).toEqual(["phone_incomplete"]);
  });

  it("без согласия, города и жилья заявку не отправить", () => {
    const errors = errorsOf({ ...valid, consent: false, city: "", housing: undefined });
    expect(errors.consent).toEqual(["consent_required"]);
    expect(errors.city).toEqual(["city_required"]);
    expect(errors.housing).toEqual(["housing_required"]);
  });
});
