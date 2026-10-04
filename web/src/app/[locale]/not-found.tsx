import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Button, EmptyState } from "@/shared/ui";

export default function NotFound() {
  const t = useTranslations("states.notFound");

  return (
    <div className="page-container py-16">
      <EmptyState
        className="mx-auto max-w-md"
        visual={<span className="font-display text-6xl text-primary">404</span>}
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild>
            <Link href="/pets">{t("action")}</Link>
          </Button>
        }
      />
    </div>
  );
}
