import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import type { PetStatus } from "../model/status";

/** Анкеты, которые ведёт человек (свои и его приютов), включая черновики. */
export async function getMyPets({ status }: { status?: PetStatus } = {}) {
  const { data, error } = await api.GET("/api/v1/me/pets", {
    params: { query: { limit: 100, status } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("my_pets_load_failed");
  return data;
}

/** Анкета для редактирования в кабинете; null — нет такой или ведёт не он. */
export async function getManagedPet(id: string) {
  const { data, response } = await api.GET("/api/v1/me/pets/{pet_id}", {
    params: { path: { pet_id: id } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if ([403, 404, 422].includes(response.status)) return null;
  if (!data) throw new Error("pet_load_failed");
  return data;
}
