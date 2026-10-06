import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

/** Последняя заявка человека; null — ещё не подавал */
export async function getMyOnboarding() {
  const { data, error, response } = await api.GET("/api/v1/onboarding/me", {
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (error || !data) throw new Error("onboarding_load_failed");
  return data;
}
