import "server-only";
import { api } from "@/shared/api";
import { personalizedFetch } from "@/shared/session";
import { PETS_PAGE_SIZE, type PetFilters } from "../model/filters";

export async function getPets(filters: PetFilters) {
  const { data, error } = await api.GET("/api/v1/pets", {
    params: { query: { ...filters, limit: filters.limit ?? PETS_PAGE_SIZE } },
    ...(await personalizedFetch({ tags: ["pets"], revalidate: 60 })),
  });
  if (error || !data) throw new Error("pets_load_failed");
  return data;
}
