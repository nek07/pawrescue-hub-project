import { cache } from "react";
import { api } from "@/shared/api";

export const getShelter = cache(async (id: string) => {
  const { data, response } = await api.GET("/api/v1/shelters/{shelter_id}", {
    params: { path: { shelter_id: id } },
    next: { tags: ["shelters", `shelter:${id}`], revalidate: 300 },
  });
  // 422 — id не UUID: для человека это тоже «такой страницы нет»
  if (response.status === 404 || response.status === 422) return null;
  if (!data) throw new Error("shelter_load_failed");
  return data;
});
