import { describe, expect, it } from "vitest";
import { petFormSchema, toPetCreateBody, toPetUpdateBody, type PetFormInput } from "./schema";

const VALID: PetFormInput = {
  shelterId: "11111111-1111-1111-1111-111111111111",
  name: "  Лиса ",
  kind: "cat",
  sex: "female",
  birthDate: "2024-04-01",
  breed: "",
  weightKg: "3,25",
  sterilized: true,
  vaccinatedAt: "",
  chip: "planned",
  litterTrained: "yes",
  traits: ["calm"],
  storyTitle: "",
  story: "Нашли у подъезда.",
};

const errors = (input: PetFormInput) => {
  const result = petFormSchema.safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe("petFormSchema", () => {
  it("переводит строки полей в значения API", () => {
    const body = toPetCreateBody(petFormSchema.parse(VALID));
    expect(body).toMatchObject({
      name: "Лиса",
      weight_kg: 3.25,
      breed: null,
      vaccinated_at: null,
      litter_trained: true,
      shelter_id: VALID.shelterId,
    });
  });

  it("анкета волонтёра — без приюта", () => {
    expect(toPetCreateBody(petFormSchema.parse({ ...VALID, shelterId: "" })).shelter_id).toBeNull();
  });

  it("при правке шлёт null, чтобы очистить поле", () => {
    const body = toPetUpdateBody(petFormSchema.parse({ ...VALID, litterTrained: "", story: " " }));
    expect(body.litter_trained).toBeNull();
    expect(body.story).toBeNull();
  });

  it("ошибки — ключи перевода", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(errors({ ...VALID, name: " ", weightKg: "200", birthDate: tomorrow })).toEqual({
      name: "name_required",
      weightKg: "weight_invalid",
      birthDate: "birth_date_future",
    });
    expect(errors({ ...VALID, birthDate: "" })).toEqual({ birthDate: "birth_date_required" });
  });
});
