import { useTranslations } from "next-intl";
import { PET_STATUSES, type PetStatus } from "@/entities/pet";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";

const STATUSES = Object.keys(PET_STATUSES) as PetStatus[];

/** Фильтр анкет кабинета по статусу — ссылки с ?status=, как в «Входящих заявках» */
export function PetStatusFilter({ active }: { active?: PetStatus }) {
  const t = useTranslations();
  const items = [
    { key: "all", href: "/cabinet", label: t("cabinet.all"), on: !active },
    ...STATUSES.map((status) => ({
      key: status,
      href: `/cabinet?status=${status}`,
      // Во множественном «Черновики», «Ищут дом» — подписи кабинета, не плашки
      label: t(`cabinet.statusFilter.${status}`),
      on: active === status,
    })),
  ];

  return (
    <nav aria-label={t("cabinet.filterLabel")}>
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
