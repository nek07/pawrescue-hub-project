import { api } from "@/shared/api";
import type { ShelterFilters } from "../model/filters";

/** Приюты и волонтёры — один список /curators */
export async function getShelters(filters: ShelterFilters = {}) {
  const { data, error } = await api.GET("/api/v1/curators", {
    params: { query: filters },
    next: { tags: ["shelters"], revalidate: 300 },
  });
  if (error || !data) throw new Error("shelters_load_failed");
  return data;
}
