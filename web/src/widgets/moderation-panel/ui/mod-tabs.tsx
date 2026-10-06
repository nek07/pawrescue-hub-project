import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { MOD_TABS, modHref, type ModTab } from "../model";

export function ModTabs({ active }: { active: ModTab }) {
  const t = useTranslations("moderation.tabs");
  return (
    <nav aria-label={t("label")} className="border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {MOD_TABS.map((tab) => (
          <li key={tab}>
            <Link
              href={modHref({ tab })}
              aria-current={tab === active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center border-b-2 px-4 text-sm whitespace-nowrap",
                tab === active
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t(tab)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
