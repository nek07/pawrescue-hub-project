import { z } from "zod";
import type { components } from "@/shared/api";
import { CITIES } from "@/shared/config";

type Schemas = components["schemas"];

export type Onboarding = Schemas["OnboardingOut"];
export type OnboardingType = Schemas["OnboardingType"];
export type OnboardingDocument = Schemas["DocumentOut"];
export type DocumentKind = Schemas["DocumentKind"];

export const ONBOARDING_TYPES = [
  "shelter",
  "volunteer",
] as const satisfies readonly OnboardingType[];

/** «Кто вы → Документы → Профиль → Проверка» */
export const STEPS = ["who", "documents", "profile", "review"] as const;
export type Step = (typeof STEPS)[number];

/** Пункт из `missing` (API) → шаг, где его заполняют */
export const MISSING_STEP: Record<string, Step> = {
  city: "who",
  contact_phone: "who",
  registration: "documents",
  territory_photos: "documents",
  about: "profile",
  address: "profile",
};

/** Первый шаг, где чего-то не хватает; всё заполнено — сразу «Проверка» */
export function firstIncompleteStep(missing: string[]): Step {
  return STEPS.find((step) => missing.some((m) => MISSING_STEP[m] === step)) ?? "review";
}

/** Совпадает с бэкендом (onboarding.schemas): проверяем ещё до загрузки */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MIN_TERRITORY_PHOTOS = 3;
export const MAX_TERRITORY_PHOTOS = 10;
/** У бэкенда предела нет: свидетельство бывает на нескольких страницах */
export const MAX_REGISTRATION_FILES = 5;
export const DOCUMENT_TYPES: Record<DocumentKind, readonly DocumentType[]> = {
  registration: ["application/pdf", "image/jpeg", "image/png"],
  territory_photo: ["image/jpeg", "image/png"],
};
export type DocumentType = Schemas["DocumentCreate"]["content_type"];

export function isDocumentType(kind: DocumentKind, type: string): type is DocumentType {
  return (DOCUMENT_TYPES[kind] as readonly string[]).includes(type);
}

/** «8 701 234 56 78» и «+7 (701) 234-56-78» → «+77012345678» */
export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return `+${digits}`;
}

/** Пустое поле → null: так в PATCH очищают необязательное поле */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "too_long" })
    .transform((v) => v || null);

/** Шаг 1. Сообщения — ключи перевода onboarding.errors.* */
export const whoSchema = z.object({
  type: z.enum(ONBOARDING_TYPES, { error: "type_required" }),
  name: z.string().trim().min(2, { error: "name_short" }).max(120, { error: "too_long" }),
  city: z.enum(CITIES, { error: "city_required" }),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^\+7\d{10}$/, { error: "phone_incomplete" })),
});

/** Шаг 3. Обязательность about/address проверит «Проверка» — черновик можно сохранить пустым */
export const profileSchema = z.object({
  about: optionalText(3000),
  address: optionalText(255),
  visitHours: optionalText(120),
});

export type WhoInput = z.input<typeof whoSchema>;
export type WhoData = z.output<typeof whoSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;

/** Ответ server action: свежая заявка или ошибки (ключи перевода) */
export type OnboardingResult =
  | { ok: true; request: Onboarding }
  | { ok: false; fieldErrors?: Record<string, string>; formError?: string };
