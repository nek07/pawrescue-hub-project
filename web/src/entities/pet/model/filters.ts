import { z } from "zod";
import { CITIES } from "@/shared/config";
import { firstValues, type RawSearchParams } from "@/shared/lib";
import { PET_AGES, PET_KINDS, PET_SORTS } from "./pet";

export const PETS_PAGE_SIZE = 24;
const MAX_LIMIT = PETS_PAGE_SIZE * 4;

// Любое кривое значение в URL просто игнорируем, а не роняем страницу
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);
const flag = optional(z.literal("true").transform(() => true as const));

const petFiltersSchema = z.object({
  q: optional(
    z
      .string()
      .trim()
      .max(100)
      .transform((v) => v || undefined),
  ),
  kind: optional(z.enum(PET_KINDS)),
  age: optional(z.enum(PET_AGES)),
  city: optional(z.enum(CITIES)),
  sterilized: flag,
  good_with_kids: flag,
  needs_foster: flag,
  sort: optional(z.enum(PET_SORTS)),
  // Питомцы одного куратора: ссылка с карточки волонтёра или приюта
  shelter_id: optional(z.uuid()),
  volunteer_id: optional(z.uuid()),
  limit: optional(z.coerce.number().int().min(PETS_PAGE_SIZE).max(MAX_LIMIT)),
});

/** Фильтры каталога. Имена совпадают с параметрами URL и API. */
export type PetFilters = z.infer<typeof petFiltersSchema>;

export function parsePetFilters(params: RawSearchParams): PetFilters {
  return petFiltersSchema.parse(firstValues(params));
}

/** Обратно в query-строку: пустые значения и значения по умолчанию не пишем. */
export function toPetSearchParams(filters: PetFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (key === "sort" && value === "new") continue;
    if (key === "limit" && value === PETS_PAGE_SIZE) continue;
    params.set(key, String(value));
  }
  return params;
}

/** Сколько фильтров спрятано под кнопкой «Фильтры» на телефоне */
export function countHiddenFilters(filters: PetFilters): number {
  return [
    filters.kind,
    filters.age,
    filters.sterilized,
    filters.good_with_kids,
    filters.needs_foster,
  ].filter(Boolean).length;
}
