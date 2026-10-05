"use server";

import type { components } from "@/shared/api";
import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";

type Comment = components["schemas"]["CommentOut"];
const KNOWN = new Set(["comment_empty", "comment_too_long", "too_many_requests"]);

export async function addComment(
  postId: string,
  body: string,
  parentId?: string,
): Promise<{ ok: true; comment: Comment } | { ok: false; error: string }> {
  const result = await api
    .POST("/api/v1/posts/{post_id}/comments", {
      params: { path: { post_id: postId } },
      body: { body, parent_id: parentId ?? null, as_shelter: false },
      headers: await sessionHeaders(),
    })
    .catch(() => null);

  if (result?.data) return { ok: true, comment: result.data };
  // Ошибка валидации приходит кодом поля (body: comment_empty) — берём его
  const error = result?.error?.error;
  const code = error?.fields?.body ?? error?.code;
  return { ok: false, error: code && KNOWN.has(code) ? code : "server_unavailable" };
}
