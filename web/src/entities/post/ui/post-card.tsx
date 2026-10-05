"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/shared/i18n";
import { Badge, Card } from "@/shared/ui";
import { POST_KIND_TONE, type Post } from "../model/post";
import { AuthorLine } from "./author-line";
import { PostPhotos } from "./post-photos";

type PostCardProps = {
  post: Post;
  /** Лайк, «Поделиться» — из features */
  actions?: ReactNode;
  /** Комментарии под постом — из widgets */
  comments?: ReactNode;
};

export function PostCard({ post, actions, comments }: PostCardProps) {
  const t = useTranslations("feed");

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <AuthorLine author={post.author} createdAt={post.created_at} />
        <Badge tone={POST_KIND_TONE[post.kind]}>{t(`kind.${post.kind}`)}</Badge>
      </div>

      <div className="flex flex-col gap-2">
        {post.title && <h2 className="font-display text-xl font-semibold">{post.title}</h2>}
        <p className="whitespace-pre-line">{post.body}</p>
      </div>

      <PostPhotos photos={post.photos} />

      {post.pet && (
        <Link
          href={`/pets/${post.pet.id}`}
          className="self-start rounded-pill border border-line px-3 py-1 text-sm hover:border-ink"
        >
          {t("aboutPet", { name: post.pet.name })}
        </Link>
      )}

      {actions && (
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3">{actions}</div>
      )}
      {comments}
    </Card>
  );
}
