import { z } from "zod";
import { CITIES } from "@/shared/config";
import { firstValues, type RawSearchParams } from "@/shared/lib";
import { SHELTER_KINDS } from "./shelter";

const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const shelterFiltersSchema = z.object({
  q: optional(
    z
      .string()
      .trim()
      .max(100)
      .transform((v) => v || undefined),
  ),
  city: optional(z.enum(CITIES)),
  type: optional(z.enum(SHELTER_KINDS)),
});

export type ShelterFilters = z.infer<typeof shelterFiltersSchema>;

export function parseShelterFilters(params: RawSearchParams): ShelterFilters {
  return shelterFiltersSchema.parse(firstValues(params));
}

export function toShelterSearchParams(filters: ShelterFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params;
}
