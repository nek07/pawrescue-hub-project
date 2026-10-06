"use server";

import { z } from "zod";
import type { components } from "@/shared/api";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import {
  profileSchema,
  whoSchema,
  type DocumentKind,
  type DocumentType,
  type OnboardingResult,
  type ProfileInput,
  type WhoInput,
} from "../model/steps";

type ApiError = { error?: { code?: string; fields?: Record<string, string> | null } };
type Failure = { ok: false; error: string };
type Update = components["schemas"]["OnboardingUpdate"];

export type DocumentTicket = {
  ok: true;
  documentId: string;
  url: string;
  headers: Record<string, string>;
};

/** Поле API → поле формы, чтобы ошибка встала под нужный ввод */
const API_FIELDS: Record<string, string> = {
  contact_phone: "phone",
  visit_hours: "visitHours",
};

function toResult(status: number | undefined, error: unknown): OnboardingResult {
  const body = error as ApiError | undefined;
  if (status === 422 && body?.error?.fields) {
    const fieldErrors = Object.fromEntries(
      Object.entries(body.error.fields).map(([field, code]) => [API_FIELDS[field] ?? field, code]),
    );
    // «Проверка»: каких шагов не хватает — показываем списком, а не под полями
    if (body.error.code === "onboarding_incomplete") {
      return { ok: false, formError: "onboarding_incomplete", fieldErrors };
    }
    return { ok: false, fieldErrors };
  }
  const code = body?.error?.code;
  return {
    ok: false,
    formError: status && [404, 409, 429].includes(status) && code ? code : "server_unavailable",
  };
}

function flatten(error: z.ZodError): OnboardingResult {
  const { fieldErrors } = z.flattenError(error);
  return {
    ok: false,
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).map(([field, codes]) => [field, (codes as string[])[0]]),
    ),
  };
}

async function patch(body: Update): Promise<OnboardingResult> {
  const result = await api
    .PATCH("/api/v1/onboarding/me", { body, headers: await sessionHeaders() })
    .catch(() => null);
  if (!result) return { ok: false, formError: "server_unavailable" };
  if (!result.data) return toResult(result.response.status, result.error);
  return { ok: true, request: result.data };
}

/**
 * Шаг 1 «Кто вы». Без заявки — создаём её; телефон POST не принимает,
 * поэтому он (и тексты прошлой отклонённой заявки) уходит следом в PATCH.
 */
export async function saveWho(
  input: WhoInput,
  options: { create: boolean; carryOver?: Update },
): Promise<OnboardingResult> {
  const parsed = whoSchema.safeParse(input);
  if (!parsed.success) return flatten(parsed.error);
  const { type, name, city, phone } = parsed.data;

  if (options.create) {
    const created = await api
      .POST("/api/v1/onboarding", {
        body: { type, name, city },
        headers: await sessionHeaders(),
      })
      .catch(() => null);
    if (!created) return { ok: false, formError: "server_unavailable" };
    // 409: заявка уже есть (двойной клик или вторая вкладка) — просто дописываем её
    if (!created.data && created.response.status !== 409) {
      return toResult(created.response.status, created.error);
    }
  }
  return patch({ ...options.carryOver, name, city, contact_phone: phone });
}

/** Шаг 2: рекомендатель — необязательный текст рядом с документами */
export async function saveRecommender(recommender: string): Promise<OnboardingResult> {
  const value = recommender.trim();
  if (value.length > 200) return { ok: false, fieldErrors: { recommender: "too_long" } };
  return patch({ recommender: value || null });
}

/** Шаг 3 «Профиль» */
export async function saveProfile(input: ProfileInput): Promise<OnboardingResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return flatten(parsed.error);
  const { about, address, visitHours } = parsed.data;
  return patch({ about, address, visit_hours: visitHours });
}

/** Шаг 4: отправить модератору — после этого заявку не правят */
export async function submitOnboarding(): Promise<OnboardingResult> {
  const result = await api
    .POST("/api/v1/onboarding/me/submit", { headers: await sessionHeaders() })
    .catch(() => null);
  if (!result) return { ok: false, formError: "server_unavailable" };
  if (!result.data) return toResult(result.response.status, result.error);
  return { ok: true, request: result.data };
}

function failure(error: unknown): Failure {
  const body = error as ApiError | undefined;
  // Ошибка поля (размер, тип) важнее общего validation_error
  const field = body?.error?.fields && Object.values(body.error.fields)[0];
  return { ok: false, error: field || body?.error?.code || "server_unavailable" };
}

/** Документ, шаг 1: билет — presigned PUT в приватное хранилище */
export async function requestDocumentUpload(
  kind: DocumentKind,
  file: { name: string; type: DocumentType; size: number },
): Promise<DocumentTicket | Failure> {
  const result = await api
    .POST("/api/v1/onboarding/me/documents", {
      body: { kind, filename: file.name.slice(0, 200), content_type: file.type, size: file.size },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return { ok: false, error: "server_unavailable" };
  if (!result.data) {
    return result.response.status === 429
      ? { ok: false, error: "too_many_requests" }
      : failure(result.error);
  }
  return {
    ok: true,
    documentId: result.data.id,
    url: result.data.upload_url,
    headers: result.data.headers,
  };
}

/** Документ, шаг 3 (после PUT из браузера): API проверяет, что файл дошёл */
export async function confirmDocument(documentId: string): Promise<{ ok: true } | Failure> {
  const result = await api
    .POST("/api/v1/onboarding/me/documents/{document_id}/confirm", {
      params: { path: { document_id: documentId } },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return { ok: false, error: "server_unavailable" };
  if (!result.data) return failure(result.error);
  return { ok: true };
}

export async function deleteDocument(documentId: string): Promise<{ ok: boolean }> {
  const result = await api
    .DELETE("/api/v1/onboarding/me/documents/{document_id}", {
      params: { path: { document_id: documentId } },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  return { ok: Boolean(result?.response.ok) };
}

/** Свежая заявка после загрузок: список документов и `missing` */
export async function reloadOnboarding(): Promise<OnboardingResult> {
  const result = await api
    .GET("/api/v1/onboarding/me", { headers: await sessionHeaders(), cache: "no-store" })
    .catch(() => null);
  if (!result?.data) return { ok: false, formError: "server_unavailable" };
  return { ok: true, request: result.data };
}
