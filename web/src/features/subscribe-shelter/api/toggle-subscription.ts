"use server";

import { refresh, updateTag } from "next/cache";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

export async function toggleSubscription(
  shelterId: string,
  subscribe: boolean,
): Promise<{ ok: true; subscribed: boolean; count: number } | { ok: false }> {
  const options = { params: { path: { shelter_id: shelterId } }, headers: await sessionHeaders() };
  const result = await (
    subscribe
      ? api.PUT("/api/v1/shelters/{shelter_id}/subscription", options)
      : api.DELETE("/api/v1/shelters/{shelter_id}/subscription", options)
  ).catch(() => null);
  if (!result?.data) return { ok: false };
  updateTag("subscriptions");
  refresh();
  return { ok: true, subscribed: result.data.subscribed, count: result.data.subscribers_count };
}
