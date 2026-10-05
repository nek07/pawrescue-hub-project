"use server";

import { refresh, updateTag } from "next/cache";
import type { ApplicationStatus } from "@/entities/application";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

const KNOWN_ERRORS = new Set([
  "transition_not_allowed",
  "application_not_found",
  "pet_not_available",
]);

/** Смена статуса заявки. Права и допустимые переходы проверяет бэкенд. */
export async function changeApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api
    .PATCH("/api/v1/applications/{application_id}", {
      params: { path: { application_id: applicationId } },
      body: { status },
      headers: await sessionHeaders(),
    })
    .catch(() => null);

  if (!result || result.error) {
    const code = result?.error?.error.code;
    return { ok: false, error: code && KNOWN_ERRORS.has(code) ? code : "server_unavailable" };
  }

  // Одобрение бронирует питомца, завершение — «Нашёл дом»: каталог тоже меняется
  updateTag("applications");
  updateTag("pets");
  refresh();
  return { ok: true };
}
