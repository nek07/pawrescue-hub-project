"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Link, usePathname } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { toggleLike, type LikeTarget } from "../api/toggle-like";

type LikeButtonProps = {
  target: LikeTarget;
  id: string;
  liked: boolean;
  count: number;
  signedIn: boolean;
  size?: "sm" | "md";
};

/**
 * Отметка «Нравится». Счётчик меняется сразу, ответ сервера его уточняет.
 * Гость видит кнопку, но она ведёт на вход — как велит гайд.
 */
export function LikeButton({ target, id, liked, count, signedIn, size = "md" }: LikeButtonProps) {
  const t = useTranslations("feed");
  const pathname = usePathname();
  const [state, setState] = useState({ liked, count });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, startTransition] = useTransition();
  const icon = size === "sm" ? "size-3.5" : "size-4";
  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-pill text-ink-muted hover:text-primary",
    size === "sm" ? "text-xs" : "px-1 text-sm",
  );

  if (!signedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { next: pathname } }}
        className={classes}
        aria-label={`${t("like")} · ${count}`}
      >
        <Heart aria-hidden className={icon} />
        {count}
      </Link>
    );
  }

  const toggle = () => {
    const next = { liked: !state.liked, count: state.count + (state.liked ? -1 : 1) };
    startTransition(async () => {
      setOptimistic(next);
      const result = await toggleLike(target, id, next.liked);
      if (result.ok) setState({ liked: result.liked, count: result.likesCount });
    });
  };

  return (
    <button
      type="button"
      aria-pressed={optimistic.liked}
      aria-label={`${optimistic.liked ? t("unlike") : t("like")} · ${optimistic.count}`}
      onClick={toggle}
      className={cn(classes, optimistic.liked && "text-primary")}
    >
      <Heart aria-hidden className={cn(icon, optimistic.liked && "fill-current")} />
      {optimistic.count}
    </button>
  );
}
