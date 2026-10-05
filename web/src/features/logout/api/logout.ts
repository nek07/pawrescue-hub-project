"use server";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { sessionHeaders } from "@/shared/session";
import { api } from "@/shared/api";
import { SESSION_COOKIE } from "@/shared/config";
import { redirect } from "@/shared/i18n";

export async function logout() {
  // Сессию отзывает бэкенд; даже если он недоступен, у браузера cookie убираем
  await api.POST("/api/v1/auth/logout", { headers: await sessionHeaders() }).catch(() => null);
  (await cookies()).delete(SESSION_COOKIE);
  redirect({ href: "/", locale: await getLocale() });
}
