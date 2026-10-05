import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Button } from "@/shared/ui";

export function FeedGuestBanner() {
  const t = useTranslations("feed.guestBanner");
  return (
    <div className="flex flex-col gap-3 rounded-sm bg-accent p-4 text-on-accent sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{t("title")}</p>
        <p className="text-sm">{t("text")}</p>
      </div>
      <Button asChild size="sm" className="self-start sm:self-center">
        <Link href={{ pathname: "/login", query: { next: "/feed" } }}>{t("action")}</Link>
      </Button>
    </div>
  );
}
