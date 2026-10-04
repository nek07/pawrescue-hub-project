"use server";

import { cookies } from "next/headers";
import { api, type components } from "@/shared/api";
import { SESSION_COOKIE } from "@/shared/config";

type UserRole = components["schemas"]["UserRole"];

/**
 * Dev-вход с сервера Next, а не из браузера: бэкенд проверяет Origin у
 * изменяющих запросов с cookie, и смена аккаунта с другого порта упиралась в 403.
 * Cookie сессии переносим из ответа API в браузер.
 */
export async function devLogin(name: string, role: UserRole): Promise<{ ok: boolean }> {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== "1") return { ok: false };

  const result = await api
    .POST("/api/v1/auth/dev-login", { body: { name, role } })
    .catch(() => null);
  const token = result?.response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.split(";")[0]
    .slice(SESSION_COOKIE.length + 1);

  if (!result?.data || !token) return { ok: false };

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}
