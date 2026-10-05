import "server-only";
import { cache } from "react";
import { api, type components } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import type { User } from "../model/user";

export type Curating = components["schemas"]["CuratingOut"];

const NOBODY: Curating = { shelters: [], volunteer: false };

/**
 * От имени каких приютов человек ведёт анкеты и проверенный ли он волонтёр.
 * Для кабинета куратора и пунктов меню; гостю и при ошибке API — «никто».
 */
export const getCurating = cache(async (user: User | null): Promise<Curating> => {
  if (!user) return NOBODY;
  const { data } = await api
    .GET("/api/v1/me/curating", { headers: await sessionHeaders(), cache: "no-store" })
    .catch(() => ({ data: undefined }));
  return data ?? NOBODY;
});
