"use server";

import { getLocale } from "next-intl/server";
import { api } from "@/shared/api";
import { redirect } from "@/shared/i18n";
import { sessionHeaders } from "@/shared/session";

export type ChatTarget = { pet_id: string } | { shelter_id: string } | { volunteer_id: string };

/**
 * Начать или продолжить беседу. Бэкенд возвращает существующую, если она уже
 * есть, — повторное нажатие не плодит диалоги.
 */
export async function startConversation(target: ChatTarget): Promise<{ error: string }> {
  const locale = await getLocale();
  const result = await api
    .POST("/api/v1/conversations", { body: target, headers: await sessionHeaders() })
    .catch(() => null);

  if (result?.response.status === 401) {
    redirect({ href: "/login", locale });
  }
  if (!result?.data) {
    return { error: result?.error?.error.code ?? "server_unavailable" };
  }
  redirect({ href: `/messages/${result.data.id}`, locale });
  return { error: "" }; // недостижимо: redirect бросает исключение
}
