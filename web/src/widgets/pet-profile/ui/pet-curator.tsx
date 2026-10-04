import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PetDetails } from "@/entities/pet";
import { curatorHref } from "@/entities/shelter";
import { Link } from "@/shared/i18n";
import { Avatar, Card } from "@/shared/ui";

export function PetCurator({ pet }: { pet: PetDetails }) {
  const t = useTranslations("petProfile");
  const { curator } = pet;

  return (
    <Card className="relative flex items-center gap-4 p-4">
      <Avatar name="" size="lg" />
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-ink-muted">{t("curator")}</p>
        <Link
          href={curatorHref(curator.type, curator.id)}
          className="font-semibold after:absolute after:inset-0 hover:underline"
        >
          {t("curatorName", { kind: curator.type, name: curator.name })}
        </Link>
        {curator.verified && (
          <p className="flex items-center gap-1 text-xs font-semibold text-success">
            <Check aria-hidden className="size-3.5" />
            {t("curatorVerified")}
          </p>
        )}
      </div>
    </Card>
  );
}

export function AdoptionProcess() {
  const t = useTranslations("petProfile.process");
  const steps = ["form", "meet", "contract"] as const;

  return (
    <section className="rounded-sm bg-accent p-5 text-on-accent">
      <h2 className="font-semibold">{t("title")}</h2>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
        {steps.map((step) => (
          <li key={step}>{t(`steps.${step}`)}</li>
        ))}
      </ol>
    </section>
  );
}
