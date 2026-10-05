"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CommentItem, fetchComments, type Post, type PostComment } from "@/entities/post";
import { CommentForm } from "@/features/comment-post";
import { LikeButton } from "@/features/like-post";

/** Первые комментарии приходят с постом; остальные догружаем по кнопке. */
type PostCommentsProps = {
  post: Post;
  signedIn: boolean;
  /** Счётчик живёт в карточке поста: его же показывает строка действий */
  total: number;
  onTotalChange: (update: (n: number) => number) => void;
};

export function PostComments({ post, signedIn, total, onTotalChange }: PostCommentsProps) {
  const t = useTranslations("feed");
  const [comments, setComments] = useState<PostComment[]>(post.comments_preview);
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string>();

  const shown = comments.reduce((n, c) => n + 1 + c.replies.length, 0);
  const hidden = Math.max(total - shown, 0);

  const loadAll = async () => {
    setLoading(true);
    const all: PostComment[] = [];
    let cursor: string | undefined;
    try {
      do {
        const page = await fetchComments(post.id, cursor);
        all.push(...page.items);
        cursor = page.next_cursor ?? undefined;
      } while (cursor);
      setComments(all);
    } finally {
      setLoading(false);
    }
  };

  const added = (comment: PostComment) => {
    onTotalChange((n) => n + 1);
    setReplyTo(undefined);
    setComments((list) =>
      comment.parent_id
        ? list.map((c) =>
            c.id === comment.parent_id ? { ...c, replies: [...c.replies, comment] } : c,
          )
        : [...list, comment],
    );
  };

  const like = (comment: PostComment) => (
    <LikeButton
      target="comment"
      id={comment.id}
      liked={comment.liked_by_me}
      count={comment.likes_count}
      signedIn={signedIn}
      size="sm"
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              actions={
                <>
                  {signedIn && (
                    <button
                      type="button"
                      className="text-ink-muted underline hover:text-ink"
                      onClick={() => setReplyTo(comment.id)}
                    >
                      {t("reply")}
                    </button>
                  )}
                  {like(comment)}
                </>
              }
            >
              {(comment.replies.length > 0 || replyTo === comment.id) && (
                <>
                  {comment.replies.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {comment.replies.map((reply) => (
                        <CommentItem key={reply.id} comment={reply} actions={like(reply)} />
                      ))}
                    </ul>
                  )}
                  {replyTo === comment.id && (
                    <CommentForm
                      postId={post.id}
                      parentId={comment.id}
                      signedIn={signedIn}
                      onAdded={added}
                      onCancel={() => setReplyTo(undefined)}
                    />
                  )}
                </>
              )}
            </CommentItem>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="self-start text-sm font-semibold text-primary hover:underline disabled:opacity-60"
        >
          {loading ? t("loading") : t("showMoreComments", { count: hidden })}
        </button>
      )}
      <CommentForm postId={post.id} signedIn={signedIn} onAdded={added} />
    </div>
  );
}
