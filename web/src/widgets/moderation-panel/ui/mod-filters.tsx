import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Button, Input } from "@/shared/ui";
import { modHref, type ModQuery } from "../model";

type Option = { key: string; label: string; query: Partial<ModQuery> };

/**
 * Поиск и переключатели над списком. Обычная GET-форма: работает без JS,
 * а адрес со всеми фильтрами можно переслать другому модератору.
 */
export function ModFilters({
  query,
  options,
  active,
  placeholder,
}: {
  query: ModQuery;
  options: Option[];
  active: string;
  /** Без подсказки поиска нет: у очереди заявок его нет и в API */
  placeholder?: string;
}) {
  const t = useTranslations("moderation.filters");
  const keep = { tab: query.tab, post: query.post, author: query.author };

  return (
    <div className="flex flex-col gap-3">
      {placeholder && (
        <form action="/moderation" className="flex gap-2" role="search">
          {Object.entries({ ...keep, visibility: query.visibility, blocked: query.blocked }).map(
            ([name, value]) =>
              value && <input key={name} type="hidden" name={name} value={value} />,
          )}
          <Input
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder={placeholder}
            aria-label={placeholder}
            maxLength={100}
          />
          <Button type="submit" variant="secondary">
            <Search aria-hidden className="size-4" />
            {t("search")}
          </Button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <Link
            key={option.key}
            href={modHref({ ...keep, q: query.q, ...option.query })}
            scroll={false}
            aria-current={option.key === active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-pill border px-4 text-sm",
              option.key === active
                ? "border-ink bg-ink text-surface"
                : "border-line bg-surface-raised hover:border-ink",
            )}
          >
            {option.label}
          </Link>
        ))}
        {(query.post || query.author || query.q) && (
          <Link
            href={modHref({ tab: query.tab })}
            className="inline-flex min-h-9 items-center gap-1 px-2 text-sm text-primary underline"
          >
            <X aria-hidden className="size-4" />
            {t("reset")}
          </Link>
        )}
      </div>
    </div>
  );
}
