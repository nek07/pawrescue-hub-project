"use server";

import { refresh } from "next/cache";
import type { components } from "@/shared/api";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

type Message = components["schemas"]["MessageOut"];
const KNOWN = new Set(["message_empty", "message_too_long", "too_many_requests"]);

/** С сервера Next: у браузерного POST бэкенд проверил бы Origin */
export async function sendMessage(
  conversationId: string,
  text: string,
): Promise<{ ok: true; message: Message } | { ok: false; error: string }> {
  const result = await api
    .POST("/api/v1/conversations/{conversation_id}/messages", {
      params: { path: { conversation_id: conversationId } },
      body: { text },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  if (result?.data) return { ok: true, message: result.data };
  const error = result?.error?.error;
  const code = error?.fields?.text ?? error?.code;
  return { ok: false, error: code && KNOWN.has(code) ? code : "server_unavailable" };
}

/** Отметить прочитанным и перерисовать серверную часть — бейдж «Сообщения» в шапке */
export async function markRead(conversationId: string): Promise<void> {
  await api
    .POST("/api/v1/conversations/{conversation_id}/read", {
      params: { path: { conversation_id: conversationId } },
      headers: await sessionHeaders(),
    })
    .catch(() => null);
  refresh();
}
