"use client";

import { CornerDownRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthorLine } from "@/entities/post";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Badge } from "@/shared/ui";
import { deleteComment, setCommentHidden } from "../api/actions";
import type { ModComment } from "../model/types";
import { AccountLine } from "./account-line";
import { ContentActions } from "./content-actions";
import { LikeToggle } from "./like-toggle";

export function ModCommentRow({ comment }: { comment: ModComment }) {
  const t = useTranslations("moderation");
  const hidden = comment.hidden_at !== null;

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4",
        hidden && "border-dashed bg-surface-sunken",
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        {comment.parent_id && <CornerDownRight aria-hidden className="size-3.5" />}
        {comment.parent_id ? t("replyTo") : t("commentTo")}{" "}
        <Link
          href={`/moderation?tab=comments&post=${comment.post_id}`}
          className="text-primary underline"
        >
          «{comment.post_title}»
        </Link>
        {comment.post_hidden && <Badge tone="neutral">{t("postHidden")}</Badge>}
      </p>
      <AuthorLine author={comment.author} createdAt={comment.created_at} size="sm" />
      <AccountLine account={comment.account} />
      {hidden && (
        <div>
          <Badge tone="inverse">{t("hiddenBadge")}</Badge>
        </div>
      )}
      <p className="text-sm whitespace-pre-line">{comment.body}</p>
      <ContentActions
        hidden={hidden}
        account={comment.account}
        onHide={(next) => setCommentHidden(comment.id, next)}
        onDelete={() => deleteComment(comment.id)}
        deleteConfirm={t("actions.deleteCommentConfirm")}
      >
        <LikeToggle target="comment" id={comment.id} count={comment.likes_count} />
      </ContentActions>
    </article>
  );
}
