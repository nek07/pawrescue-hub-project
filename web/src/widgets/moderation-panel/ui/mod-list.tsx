import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/shared/i18n";
import { buttonVariants, EmptyState } from "@/shared/ui";
import { modHref, type ModQuery } from "../model";

/** Список с общим счётчиком и переходом на следующую страницу по курсору */
export function ModList({
  query,
  total,
  nextCursor,
  empty,
  children,
}: {
  query: ModQuery;
  total: number;
  nextCursor: string | null;
  empty: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("moderation.list");
  if (empty) {
    return <EmptyState visual={<Inbox aria-hidden className="size-8" />} title={t("empty")} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{t("total", { count: total })}</p>
      {children}
      <div className="flex flex-wrap gap-3">
        {query.cursor && (
          <Link
            href={modHref({ ...query, cursor: undefined })}
            className={buttonVariants({ variant: "ghost" })}
          >
            {t("first")}
          </Link>
        )}
        {nextCursor && (
          <Link
            href={modHref({ ...query, cursor: nextCursor })}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("next")}
          </Link>
        )}
      </div>
    </div>
  );
}
