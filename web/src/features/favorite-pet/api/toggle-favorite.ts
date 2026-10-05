"use server";

import { updateTag } from "next/cache";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

export async function toggleFavorite(
  petId: string,
  favorite: boolean,
): Promise<{ ok: true; favorite: boolean } | { ok: false }> {
  const options = { params: { path: { pet_id: petId } }, headers: await sessionHeaders() };
  const result = await (
    favorite
      ? api.PUT("/api/v1/pets/{pet_id}/favorite", options)
      : api.DELETE("/api/v1/pets/{pet_id}/favorite", options)
  ).catch(() => null);
  if (!result?.data) return { ok: false };
  updateTag("favorites");
  return { ok: true, favorite: result.data.favorite };
}
