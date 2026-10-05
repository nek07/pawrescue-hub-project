import "server-only";
import { cache } from "react";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import type { User } from "../model/user";

/**
 * Ведёт ли человек питомцев (волонтёр или сотрудник приюта) — тогда ему
 * нужны «Входящие заявки». В MeOut такого признака нет, поэтому спрашиваем
 * /me/pets: бэкенд отдаёт там питомцев, которых человек курирует.
 */
export const isCurator = cache(async (user: User | null): Promise<boolean> => {
  if (!user) return false;
  if (user.role === "volunteer") return true;
  const { data } = await api
    .GET("/api/v1/me/pets", {
      params: { query: { limit: 1 } },
      headers: await sessionHeaders(),
      cache: "no-store",
    })
    .catch(() => ({ data: undefined }));
  return (data?.total ?? 0) > 0;
});
