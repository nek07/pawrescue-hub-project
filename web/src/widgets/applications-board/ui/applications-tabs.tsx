import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";

/** «Мои заявки» есть у всех, «Входящие» — только у тех, кто ведёт питомцев. */
export function ApplicationsTabs({
  active,
  showIncoming,
}: {
  active: "mine" | "incoming";
  showIncoming: boolean;
}) {
  const t = useTranslations("applications");
  const tabs = [
    { key: "mine", href: "/applications", label: t("mine.title") },
    ...(showIncoming
      ? [{ key: "incoming", href: "/applications/incoming", label: t("incoming.title") }]
      : []),
  ];
  if (tabs.length < 2) return null;

  return (
    <nav aria-label={t("tabsLabel")} className="border-b border-line">
      <ul className="flex gap-6">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.key === active ? "page" : undefined}
              className={cn(
                "-mb-px block border-b-2 py-3 text-sm whitespace-nowrap",
                tab.key === active
                  ? "border-primary font-semibold text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
