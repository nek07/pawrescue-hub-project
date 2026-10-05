import { api } from "@/shared/api";
import { POSTS_PAGE_SIZE, type FeedCategory } from "../model/post";

type FeedQuery = { category?: FeedCategory; shelter_id?: string; pet_id?: string };

/**
 * Следующие страницы ленты — из браузера: запрос идёт на /api/v1 своего домена,
 * cookie сессии уходит сама, liked_by_me приходит для вошедшего.
 */
export async function fetchPosts(query: FeedQuery, cursor?: string) {
  const { data, error } = await api.GET("/api/v1/posts", {
    params: { query: { ...query, limit: POSTS_PAGE_SIZE, cursor } },
  });
  if (error || !data) throw new Error("posts_load_failed");
  return data;
}

export async function fetchComments(postId: string, cursor?: string) {
  const { data, error } = await api.GET("/api/v1/posts/{post_id}/comments", {
    params: { path: { post_id: postId }, query: { limit: 50, cursor } },
  });
  if (error || !data) throw new Error("comments_load_failed");
  return data;
}
