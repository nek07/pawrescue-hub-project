"use server";

import { updateTag } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { sessionHeaders } from "@/shared/session";
import { api } from "@/shared/api";
import { redirect } from "@/shared/i18n";
import { applySchema, type ApplyField, type ApplyInput, type SubmitResult } from "../model/schema";

export async function submitApplication(input: ApplyInput): Promise<SubmitResult> {
  // Повторная проверка: данным из браузера не доверяем
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      ok: false,
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([field, codes]) => [field, codes?.[0]]),
      ) as Partial<Record<ApplyField, string>>,
    };
  }

  // consent уходит на бэкенд: он сам проверяет согласие
  const { petId, ...body } = parsed.data;
  const locale = await getLocale();

  const result = await api
    .POST("/api/v1/pets/{pet_id}/applications", {
      params: { path: { pet_id: petId } },
      body,
      headers: await sessionHeaders(),
    })
    .catch(() => null);

  if (!result) return { ok: false, formError: "server_unavailable" };

  const { error, response } = result;
  if (response.status === 401) {
    redirect({ href: { pathname: "/login", query: { next: `/pets/${petId}/apply` } }, locale });
  }
  if (error) {
    if (response.status === 422 && error.error.fields) {
      return { ok: false, fieldErrors: error.error.fields as Partial<Record<ApplyField, string>> };
    }
    return {
      ok: false,
      formError: response.status === 409 ? error.error.code : "server_unavailable",
    };
  }

  updateTag("applications");
  // Не тост «Успешно», а сразу переписка с куратором — как в макете
  redirect({ href: { pathname: "/messages", query: { sent: petId } }, locale });
  return { ok: false }; // недостижимо: redirect бросает исключение
}
