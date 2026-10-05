import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ShelterDetails } from "@/entities/shelter";
import { Card } from "@/shared/ui";

export function ShelterAbout({ shelter }: { shelter: ShelterDetails }) {
  const t = useTranslations();
  const rows = [
    {
      label: t("shelterProfile.about.address"),
      value: shelter.address && `${t(`cities.${shelter.city}`)}, ${shelter.address}`,
    },
    { label: t("shelterProfile.about.visits"), value: shelter.visit_hours },
    { label: t("shelterProfile.about.contacts"), value: t("shelterProfile.about.contactsValue") },
  ].filter((row) => row.value);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <p className="text-ink-muted">{shelter.about ?? t("shelterProfile.about.noDescription")}</p>
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-ink-muted">{row.label}</dt>
            <dd className="text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

const CHECKS = ["documents", "recommendation", "reviews"] as const;

/** Проверка одинакова для всех участников — показываем её у проверенных. */
export function ShelterChecks({ shelter }: { shelter: ShelterDetails }) {
  const t = useTranslations("shelterProfile.checks");
  if (!shelter.verified) return null;

  return (
    <Card className="p-5">
      <h2 className="font-semibold">{t("title")}</h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {CHECKS.map((check) => (
          <li key={check} className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            {t(check)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
