"use server";

import { updateTag } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { api } from "@/shared/api";
import { redirect } from "@/shared/i18n";
import { sessionHeaders } from "@/shared/session";
import {
  API_FIELDS,
  petFormSchema,
  toPetCreateBody,
  toPetUpdateBody,
  type PetFormField,
  type PetFormInput,
  type SavePetResult,
} from "../model/schema";

type ApiError = { error: { code: string; fields?: Record<string, string> | null } };

function parse(input: PetFormInput) {
  // Повторная проверка: данным из браузера не доверяем
  const parsed = petFormSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data };
  const { fieldErrors } = z.flattenError(parsed.error);
  return {
    result: {
      ok: false,
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([field, codes]) => [field, codes?.[0]]),
      ),
    } as SavePetResult,
  };
}

/** Ответ API → ошибки формы: 422 с полями — под поля, остальное — над кнопкой */
function toResult(status: number, error: ApiError): SavePetResult {
  if (status === 422 && error.error.fields) {
    const fieldErrors: Partial<Record<PetFormField, string>> = {};
    for (const [field, code] of Object.entries(error.error.fields)) {
      if (API_FIELDS[field]) fieldErrors[API_FIELDS[field]] = code;
    }
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  }
  return {
    ok: false,
    formError: [403, 404, 409].includes(status) ? error.error.code : "server_unavailable",
  };
}

async function toLogin(next: string) {
  redirect({ href: { pathname: "/login", query: { next } }, locale: await getLocale() });
}

/** Новая анкета — черновик; дальше человек добавляет фото на странице анкеты */
export async function createPet(input: PetFormInput): Promise<SavePetResult> {
  const { data, result: invalid } = parse(input);
  if (!data) return invalid;

  const result = await api
    .POST("/api/v1/pets", { body: toPetCreateBody(data), headers: await sessionHeaders() })
    .catch(() => null);
  if (!result) return { ok: false, formError: "server_unavailable" };
  if (result.response.status === 401) await toLogin("/cabinet/pets/new");
  if (result.error || !result.data)
    return toResult(result.response.status, result.error as ApiError);

  updateTag("my-pets");
  redirect({ href: `/cabinet/pets/${result.data.id}`, locale: await getLocale() });
  return { ok: true }; // недостижимо: redirect бросает исключение
}

export async function updatePet(petId: string, input: PetFormInput): Promise<SavePetResult> {
  const { data, result: invalid } = parse(input);
  if (!data) return invalid;

  const result = await api
    .PATCH("/api/v1/pets/{pet_id}", {
      params: { path: { pet_id: petId } },
      body: toPetUpdateBody(data),
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return { ok: false, formError: "server_unavailable" };
  if (result.response.status === 401) await toLogin(`/cabinet/pets/${petId}`);
  if (result.error) return toResult(result.response.status, result.error as ApiError);

  // Каталог, анкета и кабинет показывают свежие данные
  updateTag("pets");
  updateTag(`pet:${petId}`);
  updateTag("my-pets");
  return { ok: true };
}
