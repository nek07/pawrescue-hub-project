import { useTranslations } from "next-intl";
import type { ModerationStats } from "@/features/moderate-content";
import { Link } from "@/shared/i18n";
import { modHref } from "../model";

/** Сводка: сколько всего и сколько скрыто; плитки ведут в нужный список */
export function ModStats({ stats }: { stats: ModerationStats }) {
  const t = useTranslations("moderation.stats");
  const tiles = [
    {
      key: "posts",
      value: stats.posts,
      extra: stats.posts_hidden,
      href: modHref({ tab: "posts" }),
    },
    {
      key: "comments",
      value: stats.comments,
      extra: stats.comments_hidden,
      href: modHref({ tab: "comments" }),
    },
    { key: "likes", value: stats.likes, href: modHref({ tab: "posts" }) },
    {
      key: "users",
      value: stats.users,
      extra: stats.users_blocked,
      href: modHref({ tab: "users" }),
    },
    {
      key: "onboarding",
      value: stats.onboarding_pending,
      href: modHref({ tab: "onboarding" }),
    },
  ] as const;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => {
        const body = (
          <>
            <span className="text-sm text-ink-muted">{t(tile.key)}</span>
            <span className="font-display text-3xl">{tile.value}</span>
            {"extra" in tile && (
              <span className="text-xs text-ink-muted">
                {t(tile.key === "users" ? "blocked" : "hidden", { count: tile.extra })}
              </span>
            )}
          </>
        );
        return (
          <li key={tile.key}>
            {"href" in tile ? (
              <Link
                href={tile.href}
                className="flex h-full flex-col gap-1 rounded-sm border border-line bg-surface-raised p-4 hover:border-ink"
              >
                {body}
              </Link>
            ) : (
              <div className="flex h-full flex-col gap-1 rounded-sm border border-line bg-surface-raised p-4">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
