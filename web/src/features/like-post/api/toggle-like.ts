"use server";

import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

export type LikeTarget = "post" | "comment";
type LikeResult = { ok: true; liked: boolean; likesCount: number } | { ok: false; error: string };

/** Поставить или убрать отметку. С сервера Next — без Origin, проверка CSRF не мешает. */
export async function toggleLike(
  target: LikeTarget,
  id: string,
  like: boolean,
): Promise<LikeResult> {
  const headers = await sessionHeaders();
  const call =
    target === "post"
      ? like
        ? api.PUT("/api/v1/posts/{post_id}/like", { params: { path: { post_id: id } }, headers })
        : api.DELETE("/api/v1/posts/{post_id}/like", { params: { path: { post_id: id } }, headers })
      : like
        ? api.PUT("/api/v1/comments/{comment_id}/like", {
            params: { path: { comment_id: id } },
            headers,
          })
        : api.DELETE("/api/v1/comments/{comment_id}/like", {
            params: { path: { comment_id: id } },
            headers,
          });

  const result = await call.catch(() => null);
  if (!result?.data) return { ok: false, error: result?.error?.error.code ?? "server_unavailable" };
  return { ok: true, liked: result.data.liked, likesCount: result.data.likes_count };
}
