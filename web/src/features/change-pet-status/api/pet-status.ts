"use server";

import { updateTag } from "next/cache";
import { getLocale } from "next-intl/server";
import type { PetStatus } from "@/entities/pet";
import { api } from "@/shared/api";
import { redirect } from "@/shared/i18n";
import { sessionHeaders } from "@/shared/session";

export type StatusResult = { ok: true } | { ok: false; error: string; missing?: string[] };

type ApiError = { error?: { code?: string; fields?: Record<string, string> | null } };

function failure(error: unknown): StatusResult {
  const body = error as ApiError | undefined;
  return {
    ok: false,
    error: body?.error?.code ?? "server_unavailable",
    // publish_incomplete: {story: "required", photos: "required"}
    missing: body?.error?.fields ? Object.keys(body.error.fields) : undefined,
  };
}

function revalidate(petId: string) {
  updateTag("pets");
  updateTag(`pet:${petId}`);
  updateTag("my-pets");
}

/** Черновик → «Ищет дом»: бэкенд требует историю и хотя бы одно фото */
export async function publishPet(petId: string): Promise<StatusResult> {
  const result = await api
    .POST("/api/v1/pets/{pet_id}/publish", {
      params: { path: { pet_id: petId } },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return { ok: false, error: "server_unavailable" };
  if (!result.data) return failure(result.error);
  revalidate(petId);
  return { ok: true };
}

/** Руками — только «Ищет дом» ↔ «Нужна передержка» ↔ «На лечении» */
export async function setPetStatus(petId: string, status: PetStatus): Promise<StatusResult> {
  const result = await api
    .PATCH("/api/v1/pets/{pet_id}/status", {
      params: { path: { pet_id: petId } },
      body: { status },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return { ok: false, error: "server_unavailable" };
  if (!result.data) return failure(result.error);
  revalidate(petId);
  return { ok: true };
}

/** Удалить можно только черновик; после — обратно в кабинет */
export async function deleteDraft(petId: string): Promise<StatusResult> {
  const result = await api
    .DELETE("/api/v1/pets/{pet_id}", {
      params: { path: { pet_id: petId } },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return { ok: false, error: "server_unavailable" };
  if (!result.response.ok) return failure(result.error);
  updateTag("my-pets");
  redirect({ href: "/cabinet", locale: await getLocale() });
  return { ok: true };
}
