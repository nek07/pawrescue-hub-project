"use client";

import { Check } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Avatar } from "@/shared/ui";
import type { PostAuthor } from "../model/post";
import { HAS_CITY_CHOICE } from "@/shared/config";

/** Автор поста или комментария: аватар, имя, «проверен», кто это и когда */
export function AuthorLine({
  author,
  createdAt,
  size = "md",
  caption,
}: {
  author: PostAuthor;
  createdAt: string;
  size?: "sm" | "md";
  /** Своя подпись вместо «Приют · Павлодар» */
  caption?: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const name =
    author.type === "shelter"
      ? t("shelter.name", { kind: "shelter", name: author.name })
      : author.name;
  const meta = [
    caption ?? t(`feed.author.${author.type}`),
    HAS_CITY_CHOICE && author.city && t(`cities.${author.city}`),
    // «Сейчас» берётся при загрузке страницы: свежий комментарий не должен
    // оказаться «через 2 секунды»
    format.relativeTime(new Date(createdAt), Math.max(now.getTime(), Date.parse(createdAt))),
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3">
      <Avatar
        name={author.type === "shelter" ? "" : author.name}
        src={author.avatar_url}
        size={size}
      />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <span className="font-semibold">{name}</span>
          {author.verified && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-success">
              <Check aria-hidden className="size-3.5" />
              {t("feed.verified")}
            </span>
          )}
        </p>
        <p className="text-xs text-ink-muted">{meta.join(" · ")}</p>
      </div>
    </div>
  );
}
