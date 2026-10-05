import { useTranslations } from "next-intl";
import { FEED_CATEGORIES, type FeedCategory } from "@/entities/post";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";

/** Разделы ленты — ссылки с ?category=: на десктопе колонкой слева, на телефоне лентой чипов. */
export function FeedCategories({ active }: { active: FeedCategory }) {
  const t = useTranslations("feed");

  return (
    <nav aria-label={t("categoriesLabel")} className="min-w-0">
      <p className="mb-2 hidden text-xs font-semibold tracking-wider text-ink-muted uppercase lg:block">
        {t("eyebrow")}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {FEED_CATEGORIES.map((category) => (
          <li key={category} className="shrink-0">
            <Link
              href={category === "all" ? "/feed" : `/feed?category=${category}`}
              scroll={false}
              aria-current={category === active ? "page" : undefined}
              className={cn(
                "block rounded-pill px-4 py-2 text-sm whitespace-nowrap transition-colors",
                category === active
                  ? "bg-ink font-semibold text-surface"
                  : "border border-line bg-surface-raised hover:border-ink lg:border-transparent lg:bg-transparent",
              )}
            >
              {t(`category.${category}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
