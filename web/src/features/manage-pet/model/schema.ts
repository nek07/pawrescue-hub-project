import { z } from "zod";
import { PET_CHIPS, PET_KINDS, PET_SEXES, PET_TRAITS, type PetDetails } from "@/entities/pet";
import type { components } from "@/shared/api";
import { CITIES } from "@/shared/config";

type Schemas = components["schemas"];

/** Пустое поле ввода → null (в API так «очищают» необязательное поле) */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "too_long" })
    .transform((v) => v || null);

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Форма анкеты в кабинете. Значения — строки, как в полях ввода; в тело
 * запроса их переводит toPetBody. Сообщения — ключи перевода petForm.errors.*.
 */
export const petFormSchema = z.object({
  /** "" — анкета от своего имени (проверенный волонтёр) */
  shelterId: z.string(),
  name: z.string().trim().min(1, { error: "name_required" }).max(60, { error: "too_long" }),
  kind: z.enum(PET_KINDS, { error: "kind_required" }),
  sex: z.enum(PET_SEXES, { error: "sex_required" }),
  birthDate: z
    .string()
    .regex(isoDate, { error: "birth_date_required" })
    .refine((d) => d <= new Date().toISOString().slice(0, 10), { error: "birth_date_future" }),
  city: z.enum(CITIES).optional(),
  breed: optionalText(80),
  weightKg: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v < 100), {
      error: "weight_invalid",
    }),
  sterilized: z.boolean(),
  vaccinatedAt: z
    .string()
    .refine((v) => !v || isoDate.test(v), { error: "date_invalid" })
    .transform((v) => v || null),
  chip: z.enum(PET_CHIPS),
  litterTrained: z.enum(["", "yes", "no"]).transform((v) => (v ? v === "yes" : null)),
  traits: z.array(z.enum(PET_TRAITS)),
  storyTitle: optionalText(160),
  story: optionalText(5000),
});

export type PetFormInput = z.input<typeof petFormSchema>;
export type PetFormData = z.output<typeof petFormSchema>;
export type PetFormField = keyof PetFormInput;

/** Данные формы → тело PATCH /pets/{id} (все поля, чтобы очистка доходила до API) */
export function toPetUpdateBody(data: PetFormData): Schemas["PetUpdate"] {
  return {
    name: data.name,
    kind: data.kind,
    sex: data.sex,
    birth_date: data.birthDate,
    breed: data.breed,
    weight_kg: data.weightKg,
    sterilized: data.sterilized,
    vaccinated_at: data.vaccinatedAt,
    chip: data.chip,
    litter_trained: data.litterTrained,
    traits: data.traits,
    story_title: data.storyTitle,
    story: data.story,
    ...(data.city ? { city: data.city } : {}),
  };
}

/** Данные формы → тело POST /pets */
export function toPetCreateBody(data: PetFormData): Schemas["PetCreate"] {
  const { name, kind, sex, birth_date, ...rest } = toPetUpdateBody(data);
  return {
    ...rest,
    name: name!,
    kind: kind!,
    sex: sex!,
    birth_date: birth_date!,
    shelter_id: data.shelterId || null,
  };
}

/** Анкета из API → значения полей формы редактирования */
export function toPetFormValues(pet: PetDetails): PetFormInput {
  return {
    shelterId: pet.curator.type === "shelter" ? pet.curator.id : "",
    name: pet.name,
    kind: pet.kind,
    sex: pet.sex,
    birthDate: pet.birth_date,
    // Город, где платформа сейчас не работает, в форме не показываем и не меняем
    city: CITIES.find((c) => c === pet.city),
    breed: pet.breed ?? "",
    weightKg: pet.weight_kg === null ? "" : String(pet.weight_kg),
    sterilized: pet.sterilized,
    vaccinatedAt: pet.vaccinated_at ?? "",
    chip: pet.chip,
    litterTrained: pet.litter_trained === null ? "" : pet.litter_trained ? "yes" : "no",
    traits: pet.traits,
    storyTitle: pet.story_title ?? "",
    story: pet.story ?? "",
  };
}

/** Поле API (snake_case) → поле формы, чтобы показать ошибку бэкенда под нужным полем */
export const API_FIELDS: Record<string, PetFormField> = {
  name: "name",
  kind: "kind",
  sex: "sex",
  birth_date: "birthDate",
  city: "city",
  breed: "breed",
  weight_kg: "weightKg",
  vaccinated_at: "vaccinatedAt",
  chip: "chip",
  litter_trained: "litterTrained",
  traits: "traits",
  story_title: "storyTitle",
  story: "story",
  shelter_id: "shelterId",
};

export type SavePetResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Partial<Record<PetFormField, string>>; formError?: string };
