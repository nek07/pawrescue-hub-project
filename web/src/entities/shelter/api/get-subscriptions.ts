import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

/** Приюты и волонтёры, на которых подписан текущий пользователь */
export async function getSubscriptions() {
  const { data, error } = await api.GET("/api/v1/me/subscriptions", {
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("subscriptions_load_failed");
  return data;
}
