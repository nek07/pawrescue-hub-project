import "server-only";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import { POSTS_PAGE_SIZE, type FeedCategory, type PostKind } from "../model/post";

type FeedQuery = {
  category?: FeedCategory;
  kind?: PostKind;
  shelter_id?: string;
  pet_id?: string;
  limit?: number;
};

/** Первая страница ленты на сервере; cookie нужна для liked_by_me */
export async function getPosts(query: FeedQuery = {}) {
  const { data, error } = await api.GET("/api/v1/posts", {
    params: { query: { limit: POSTS_PAGE_SIZE, ...query } },
    headers: await sessionHeaders(),
    cache: "no-store",
  });
  if (error || !data) throw new Error("posts_load_failed");
  return data;
}
