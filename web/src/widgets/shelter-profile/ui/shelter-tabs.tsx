import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";

export const SHELTER_TABS = ["pets", "feed", "about"] as const;
export type ShelterTab = (typeof SHELTER_TABS)[number];

/** Вкладки — ссылки с ?tab=: открытую вкладку можно отправить ссылкой. */
export function ShelterTabs({ shelterId, active }: { shelterId: string; active: ShelterTab }) {
  const t = useTranslations("shelterProfile");

  return (
    <nav aria-label={t("tabsLabel")} className="border-b border-line">
      <ul className="flex gap-6 overflow-x-auto">
        {SHELTER_TABS.map((tab) => (
          <li key={tab}>
            <Link
              href={tab === "pets" ? `/shelters/${shelterId}` : `/shelters/${shelterId}?tab=${tab}`}
              scroll={false}
              aria-current={tab === active ? "page" : undefined}
              className={cn(
                "-mb-px block border-b-2 py-3 text-sm whitespace-nowrap",
                tab === active
                  ? "border-primary font-semibold text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t(`tabs.${tab}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
