import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { api } from "@/shared/api";
import { SESSION_COOKIE } from "@/shared/config";
import type { User } from "../model/user";

/**
 * Текущий пользователь или null для гостя. Обёрнута в cache():
 * за один запрос страницы — один вызов /auth/me, сколько бы раз её ни звали.
 */
export const getSession = cache(async (): Promise<User | null> => {
  const store = await cookies();
  if (!store.has(SESSION_COOKIE)) return null;

  try {
    const { data, response } = await api.GET("/api/v1/auth/me", {
      headers: { cookie: store.toString() },
      cache: "no-store",
    });
    if (data) return data;
    if (response.status !== 401) {
      console.error(`[session] /auth/me ответил ${response.status}`);
    }
  } catch (error) {
    // API недоступен — показываем сайт гостю, а не страницу ошибки
    console.error("[session] API недоступен", error);
  }
  return null;
});
