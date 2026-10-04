import { cache } from "react";
import { api } from "@/shared/api";

/** Анкета питомца или null, если её нет. cache(): метаданные и страница — один запрос. */
export const getPet = cache(async (id: string) => {
  const { data, response } = await api.GET("/api/v1/pets/{pet_id}", {
    params: { path: { pet_id: id } },
    next: { tags: ["pets", `pet:${id}`], revalidate: 60 },
  });
  // 422 — id не UUID: для человека это тоже «такой страницы нет»
  if (response.status === 404 || response.status === 422) return null;
  if (!data) throw new Error("pet_load_failed");
  return data;
});
