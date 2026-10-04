import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Button } from "@/shared/ui";

/** Призыв подключиться: на главной — развёрнутый, в списке приютов — короткий. */
export function PartnerCta({ variant = "home" }: { variant?: "home" | "shelters" }) {
  const t = useTranslations();
  const text =
    variant === "home"
      ? {
          title: t("home.partner.title"),
          text: t("home.partner.text"),
          action: t("home.partner.action"),
        }
      : {
          title: t("shelters.cta.title"),
          text: t("shelters.cta.text"),
          action: t("shelters.cta.action"),
        };

  return (
    <section className={variant === "home" ? "page-container py-12" : undefined}>
      <div className="flex flex-col gap-6 rounded-sm bg-accent p-6 text-on-accent sm:p-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{text.title}</h2>
          <p className="mt-2 text-sm">{text.text}</p>
        </div>
        <Button asChild size="lg" className="self-start md:self-center">
          <Link href="/onboarding">{text.action}</Link>
        </Button>
      </div>
    </section>
  );
}
