"use server";

import { api } from "@/shared/api";
import { sessionHeaders } from "@/shared/session";
import type { LikeTarget, Liker } from "../model/types";

export type ModResult = { ok: true } | { ok: false; error: string };

type Call = Promise<{ response: Response; error?: unknown }>;

/** Все действия модератора отвечают 204 — смотрим только на статус */
async function run(call: Call): Promise<ModResult> {
  const result = await call.catch(() => null);
  if (!result) return { ok: false, error: "server_unavailable" };
  if (result.response.ok) return { ok: true };
  const body = result.error as { error?: { code?: string } } | undefined;
  return { ok: false, error: body?.error?.code ?? "server_unavailable" };
}

export async function setPostHidden(postId: string, hidden: boolean) {
  const init = { params: { path: { post_id: postId } }, headers: await sessionHeaders() };
  return run(
    hidden
      ? api.PUT("/api/v1/moderation/posts/{post_id}/hidden", init)
      : api.DELETE("/api/v1/moderation/posts/{post_id}/hidden", init),
  );
}

export async function deletePost(postId: string) {
  return run(
    api.DELETE("/api/v1/moderation/posts/{post_id}", {
      params: { path: { post_id: postId } },
      headers: await sessionHeaders(),
    }),
  );
}

export async function setCommentHidden(commentId: string, hidden: boolean) {
  const init = { params: { path: { comment_id: commentId } }, headers: await sessionHeaders() };
  return run(
    hidden
      ? api.PUT("/api/v1/moderation/comments/{comment_id}/hidden", init)
      : api.DELETE("/api/v1/moderation/comments/{comment_id}/hidden", init),
  );
}

export async function deleteComment(commentId: string) {
  return run(
    api.DELETE("/api/v1/moderation/comments/{comment_id}", {
      params: { path: { comment_id: commentId } },
      headers: await sessionHeaders(),
    }),
  );
}

export async function setUserBlocked(userId: string, blocked: boolean) {
  const init = { params: { path: { user_id: userId } }, headers: await sessionHeaders() };
  return run(
    blocked
      ? api.PUT("/api/v1/moderation/users/{user_id}/blocked", init)
      : api.DELETE("/api/v1/moderation/users/{user_id}/blocked", init),
  );
}

/** Кто лайкнул — список раскрывается по кнопке, поэтому грузится из браузера */
export async function getLikers(
  target: LikeTarget,
  id: string,
): Promise<{ ok: true; items: Liker[]; total: number } | { ok: false; error: string }> {
  const init = { params: { query: { limit: 100 } }, headers: await sessionHeaders() };
  const result = await (
    target === "post"
      ? api.GET("/api/v1/moderation/posts/{post_id}/likes", {
          ...init,
          params: { ...init.params, path: { post_id: id } },
        })
      : api.GET("/api/v1/moderation/comments/{comment_id}/likes", {
          ...init,
          params: { ...init.params, path: { comment_id: id } },
        })
  ).catch(() => null);
  if (!result?.data) return { ok: false, error: "server_unavailable" };
  return { ok: true, items: result.data.items, total: result.data.total };
}

export async function removeLike(target: LikeTarget, id: string, userId: string) {
  const headers = await sessionHeaders();
  return run(
    target === "post"
      ? api.DELETE("/api/v1/moderation/posts/{post_id}/likes/{user_id}", {
          params: { path: { post_id: id, user_id: userId } },
          headers,
        })
      : api.DELETE("/api/v1/moderation/comments/{comment_id}/likes/{user_id}", {
          params: { path: { comment_id: id, user_id: userId } },
          headers,
        }),
  );
}
