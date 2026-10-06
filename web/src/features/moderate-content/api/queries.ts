import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import { MOD_PAGE_SIZE, type ReviewStatus, type Visibility } from "../model/types";

type ContentQuery = { visibility?: Visibility; q?: string; author_id?: string; cursor?: string };

async function load<T>(request: Promise<{ data?: T; error?: unknown }>, what: string) {
  const { data, error } = await request;
  if (error || !data) throw new Error(`${what}_load_failed`);
  return data;
}

export async function getModerationStats() {
  return load(
    api.GET("/api/v1/moderation/stats", { headers: await sessionHeaders(), cache: "no-store" }),
    "moderation_stats",
  );
}

/** Все посты, включая скрытые */
export async function getModPosts(query: ContentQuery) {
  return load(
    api.GET("/api/v1/moderation/posts", {
      params: { query: { limit: MOD_PAGE_SIZE, ...query } },
      headers: await sessionHeaders(),
      cache: "no-store",
    }),
    "moderation_posts",
  );
}

/** Все комментарии и ответы, включая скрытые */
export async function getModComments(query: ContentQuery & { post_id?: string }) {
  return load(
    api.GET("/api/v1/moderation/comments", {
      params: { query: { limit: MOD_PAGE_SIZE, ...query } },
      headers: await sessionHeaders(),
      cache: "no-store",
    }),
    "moderation_comments",
  );
}

export async function getModUsers(query: { q?: string; blocked?: boolean; cursor?: string }) {
  return load(
    api.GET("/api/v1/moderation/users", {
      params: { query: { limit: MOD_PAGE_SIZE, ...query } },
      headers: await sessionHeaders(),
      cache: "no-store",
    }),
    "moderation_users",
  );
}

/** Заявки приютов и волонтёров; по умолчанию — ждущие решения, старые сверху */
export async function getModOnboarding(query: { status?: ReviewStatus; cursor?: string }) {
  return load(
    api.GET("/api/v1/moderation/onboarding", {
      params: { query: { limit: MOD_PAGE_SIZE, ...query } },
      headers: await sessionHeaders(),
      cache: "no-store",
    }),
    "moderation_onboarding",
  );
}
