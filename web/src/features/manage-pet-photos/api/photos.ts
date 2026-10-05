"use server";

import { updateTag } from "next/cache";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import type { PhotoType } from "../model/limits";

type Failure = { ok: false; error: string };
export type UploadTicket = {
  ok: true;
  uploadId: string;
  url: string;
  headers: Record<string, string>;
};
export type UploadStatus = {
  ok: true;
  status: "pending" | "processing" | "done" | "failed";
  error: string | null;
};

const unavailable: Failure = { ok: false, error: "server_unavailable" };

function failure(error: unknown, fallback = "server_unavailable"): Failure {
  const body = error as
    { error?: { code?: string; fields?: Record<string, string> | null } } | undefined;
  // Ошибка поля (размер, тип) важнее общего validation_error
  const field = body?.error?.fields && Object.values(body.error.fields)[0];
  return { ok: false, error: field || body?.error?.code || fallback };
}

/** Шаг 1: билет на загрузку — presigned PUT в хранилище на 15 минут */
export async function requestPhotoUpload(
  petId: string,
  contentType: PhotoType,
  size: number,
): Promise<UploadTicket | Failure> {
  const result = await api
    .POST("/api/v1/media/uploads", {
      body: { purpose: "pet_photo", pet_id: petId, content_type: contentType, size },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return unavailable;
  if (!result.data) return failure(result.error);
  return {
    ok: true,
    uploadId: result.data.id,
    url: result.data.upload_url,
    headers: result.data.headers,
  };
}

/** Шаг 3 (после PUT из браузера): API проверяет файл и ставит его воркеру */
export async function confirmPhotoUpload(uploadId: string): Promise<UploadStatus | Failure> {
  const result = await api
    .POST("/api/v1/media/uploads/{upload_id}/confirm", {
      params: { path: { upload_id: uploadId } },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result) return unavailable;
  if (!result.data) return failure(result.error);
  return { ok: true, status: result.data.status, error: result.data.error };
}

/** Шаг 4: готов ли WebP — опрашиваем, пока воркер не закончит */
export async function getPhotoUploadStatus(uploadId: string): Promise<UploadStatus | Failure> {
  const result = await api
    .GET("/api/v1/media/uploads/{upload_id}", {
      params: { path: { upload_id: uploadId } },
      headers: await sessionHeaders(),
      cache: "no-store",
    })
    .catch(() => null);
  if (!result) return unavailable;
  if (!result.data) return failure(result.error);
  return { ok: true, status: result.data.status, error: result.data.error };
}

/** Фото поменялись — каталог, анкета и кабинет должны показать новое */
export async function revalidatePetPhotos(petId: string) {
  updateTag("pets");
  updateTag(`pet:${petId}`);
  updateTag("my-pets");
}

export async function deletePetPhoto(petId: string, photoId: string): Promise<{ ok: boolean }> {
  const result = await api
    .DELETE("/api/v1/pets/{pet_id}/photos/{photo_id}", {
      params: { path: { pet_id: petId, photo_id: photoId } },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result?.response.ok) return { ok: false };
  await revalidatePetPhotos(petId);
  return { ok: true };
}

/** Первое фото — обложка в каталоге */
export async function reorderPetPhotos(
  petId: string,
  photoIds: string[],
): Promise<{ ok: boolean }> {
  const result = await api
    .PUT("/api/v1/pets/{pet_id}/photos/order", {
      params: { path: { pet_id: petId } },
      body: { photo_ids: photoIds },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (!result?.data) return { ok: false };
  await revalidatePetPhotos(petId);
  return { ok: true };
}
