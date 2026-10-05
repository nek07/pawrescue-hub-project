"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Card } from "@/shared/ui";
import type { Post } from "../model/post";

/**
 * История для главной: «до» и «дома» рядом, как в макете. Фото с метками
 * before/after берём из поста; нет фото — две плитки-заглушки с подписями.
 */
export function StoryCard({ post, href }: { post: Post; href: string }) {
  const t = useTranslations("home.stories");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const before = post.photos.find((p) => p.label === "before") ?? post.photos[0];
  const after = post.photos.find((p) => p.label === "after") ?? post.photos[1];
  const author = post.author.type === "shelter" ? `«${post.author.name}»` : post.author.name;

  return (
    <Card className="relative flex w-full flex-col gap-3 p-3 transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="grid grid-cols-2 gap-2">
        {[
          { photo: before, label: t("before"), tone: "bg-surface-sunken" },
          { photo: after, label: t("after"), tone: "bg-accent" },
        ].map(({ photo, label, tone }) => (
          <div key={label} className={`relative aspect-square overflow-hidden rounded-sm ${tone}`}>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.card_url} alt="" className="size-full object-cover" />
            )}
            <span className="absolute bottom-2 left-2 text-xs font-semibold text-on-accent">
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-1">
        <h3 className="font-display text-lg leading-snug font-semibold">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-sm focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ink"
          >
            {post.title ?? post.body.slice(0, 60)}
          </Link>
        </h3>
        <p className="line-clamp-3 text-sm text-ink-muted">{post.body}</p>
      </div>
      <p className="flex justify-between gap-2 border-t border-line px-1 pt-2 text-xs text-ink-muted">
        <span className="truncate">{author}</span>
        <span className="shrink-0">
          {format.relativeTime(
            new Date(post.created_at),
            Math.max(now.getTime(), Date.parse(post.created_at)),
          )}
        </span>
      </p>
    </Card>
  );
}
