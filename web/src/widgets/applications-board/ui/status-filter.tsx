import { useTranslations } from "next-intl";
import { APPLICATION_STATUS_LIST, type ApplicationStatus } from "@/entities/application";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";

/** Фильтр входящих по статусу — ссылки с ?status=, как фильтры каталога. */
export function StatusFilter({ active }: { active?: ApplicationStatus }) {
  const t = useTranslations();
  const items = [
    {
      key: "all",
      href: "/applications/incoming",
      label: t("applications.incoming.all"),
      on: !active,
    },
    ...APPLICATION_STATUS_LIST.map((status) => ({
      key: status,
      href: `/applications/incoming?status=${status}`,
      label: t(`application.status.${status}`),
      on: active === status,
    })),
  ];

  return (
    <nav aria-label={t("applications.incoming.filterLabel")}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.on ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-pill border px-4 text-sm transition-colors",
                item.on
                  ? "border-ink bg-ink text-surface"
                  : "border-line bg-surface-raised text-ink hover:border-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
