"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthorLine } from "@/entities/post";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Badge, buttonVariants } from "@/shared/ui";
import { deletePost, setPostHidden } from "../api/actions";
import type { ModPost } from "../model/types";
import { AccountLine } from "./account-line";
import { ContentActions } from "./content-actions";
import { LikeToggle } from "./like-toggle";

export function ModPostRow({ post }: { post: ModPost }) {
  const t = useTranslations("moderation");
  const hidden = post.hidden_at !== null;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4",
        hidden && "border-dashed bg-surface-sunken",
      )}
    >
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <AuthorLine author={post.author} createdAt={post.created_at} size="sm" />
          <AccountLine account={post.account} />
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{t(`kind.${post.kind}`)}</Badge>
            {post.pet_name && <Badge tone="accent">{post.pet_name}</Badge>}
            {hidden && <Badge tone="inverse">{t("hiddenBadge")}</Badge>}
            {post.photos_count > 0 && (
              <Badge tone="neutral">{t("photos", { count: post.photos_count })}</Badge>
            )}
          </div>
          {post.title && <h3 className="font-semibold">{post.title}</h3>}
          <p className="line-clamp-4 text-sm whitespace-pre-line">{post.body}</p>
        </div>
        {post.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_url}
            alt=""
            className="hidden size-24 shrink-0 rounded-sm object-cover sm:block"
          />
        )}
      </div>
      <ContentActions
        hidden={hidden}
        account={post.account}
        onHide={(next) => setPostHidden(post.id, next)}
        onDelete={() => deletePost(post.id)}
        deleteConfirm={t("actions.deletePostConfirm")}
      >
        <LikeToggle target="post" id={post.id} count={post.likes_count} />
        <Link
          href={`/moderation?tab=comments&post=${post.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <MessageCircle aria-hidden className="size-4" />
          {t("comments", { count: post.comments_count })}
        </Link>
      </ContentActions>
    </article>
  );
}
