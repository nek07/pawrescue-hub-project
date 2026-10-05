import { api } from "@/shared/api";

/** Запросы из браузера: GET идут на /api/v1 своего домена с cookie сессии */
export async function fetchConversations() {
  const { data, error } = await api.GET("/api/v1/conversations", {
    params: { query: { limit: 50 } },
  });
  if (error || !data) throw new Error("conversations_load_failed");
  return data;
}

export async function fetchMessages(conversationId: string, cursor?: string) {
  const { data, error } = await api.GET("/api/v1/conversations/{conversation_id}/messages", {
    params: { path: { conversation_id: conversationId }, query: { limit: 50, cursor } },
  });
  if (error || !data) throw new Error("messages_load_failed");
  return data;
}

export async function fetchUnread() {
  const { data } = await api.GET("/api/v1/conversations/unread");
  return data?.count ?? 0;
}
