import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

export async function getConversations() {
  const { data, error } = await api.GET("/api/v1/conversations", {
    params: { query: { limit: 50 } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("conversations_load_failed");
  return data;
}

/** Беседа или null — чужая и несуществующая выглядят одинаково (404) */
export async function getConversation(id: string) {
  const { data, response } = await api.GET("/api/v1/conversations/{conversation_id}", {
    params: { path: { conversation_id: id } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (response.status === 404 || response.status === 422) return null;
  if (!data) throw new Error("conversation_load_failed");
  return data;
}

export async function getMessages(id: string) {
  const { data, error } = await api.GET("/api/v1/conversations/{conversation_id}/messages", {
    params: { path: { conversation_id: id }, query: { limit: 50 } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("messages_load_failed");
  return data;
}

/** Непрочитанные — для бейджа «Сообщения» в шапке */
export async function getUnreadCount() {
  const { data } = await api
    .GET("/api/v1/conversations/unread", { headers: await sessionHeaders(), cache: "no-store" })
    .catch(() => ({ data: undefined }));
  return data?.count ?? 0;
}
