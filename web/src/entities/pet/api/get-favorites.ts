import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

/** Избранные питомцы текущего пользователя */
export async function getFavoritePets() {
  const { data, error } = await api.GET("/api/v1/me/favorites", {
    params: { query: { limit: 100 } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("favorites_load_failed");
  return data;
}
