import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import type { ApplicationStatus } from "../model/application";

type Query = { status?: ApplicationStatus; limit?: number };

/** Заявки, которые подал текущий пользователь */
export async function getMyApplications(query: Query = {}) {
  const { data, error } = await api.GET("/api/v1/applications/me", {
    params: { query: { limit: 50, ...query } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("applications_load_failed");
  return data;
}

/** Заявки на питомцев, которых ведёт текущий пользователь (приют или волонтёр) */
export async function getIncomingApplications(query: Query = {}) {
  const { data, error } = await api.GET("/api/v1/applications/incoming", {
    params: { query: { limit: 50, ...query } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("applications_load_failed");
  return data;
}
