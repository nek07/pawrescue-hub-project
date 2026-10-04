import { z } from "zod";
import type { components } from "@/shared/api";
import { CITIES } from "@/shared/config";

type Schemas = components["schemas"];

export const HOUSING = ["flat", "house", "rent"] as const satisfies readonly Schemas["Housing"][];
export const HOUSEHOLD = [
  "kids",
  "cats",
  "dogs",
] as const satisfies readonly Schemas["Household"][];

/** «8 701 234 56 78» и «+7 (701) 234-56-78» → «+77012345678» */
export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Одна схема на браузер и server action. Сообщения — ключи перевода
 * (applyForPet.errors.*), а не текст.
 */
export const applySchema = z.object({
  petId: z.string().min(1),
  name: z.string().trim().min(2, { error: "name_short" }),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^\+7\d{10}$/, { error: "phone_incomplete" })),
  city: z.enum(CITIES, { error: "city_required" }),
  housing: z.enum(HOUSING, { error: "housing_required" }),
  household: z.array(z.enum(HOUSEHOLD)),
  about: z.string().trim().max(1000, { error: "about_long" }).optional(),
  consent: z.literal(true, { error: "consent_required" }),
});

export type ApplyInput = z.input<typeof applySchema>;
export type ApplyData = z.output<typeof applySchema>;
export type ApplyField = keyof ApplyInput;

export type SubmitResult = {
  ok: false;
  fieldErrors?: Partial<Record<ApplyField, string>>;
  formError?: string;
};
