import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, Card } from "@/shared/ui";
import type { ShelterListItem } from "../model/shelter";
import { ShelterLink } from "./shelter-link";
import { HAS_CITY_CHOICE } from "@/shared/config";

/** Карточка в списке приютов: обложка, аватар, проверка и счётчики. */
export function ShelterCard({ shelter }: { shelter: ShelterListItem }) {
  const t = useTranslations();
  const bold = (chunks: React.ReactNode) => <strong className="text-ink">{chunks}</strong>;

  return (
    <Card className="relative flex w-full flex-col transition-shadow focus-within:shadow-md hover:shadow-md">
      <div aria-hidden className="h-20 bg-surface-sunken" />
      <div className="flex flex-1 flex-col gap-1 px-5 pb-5">
        <Avatar
          name=""
          src={shelter.avatar_url}
          size="lg"
          className="-mt-7 mb-2 ring-4 ring-surface-raised"
        />
        <p className="text-sm text-ink-muted">
          {HAS_CITY_CHOICE && shelter.city
            ? t("shelterProfile.meta", { kind: shelter.type, city: t(`cities.${shelter.city}`) })
            : t("shelter.kind", { kind: shelter.type })}
        </p>
        <h2 className="font-display text-xl font-semibold">
          <ShelterLink type={shelter.type} id={shelter.id}>
            {t("shelter.name", { kind: shelter.type, name: shelter.name })}
          </ShelterLink>
        </h2>
        {shelter.verified && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <Check aria-hidden className="size-4" />
            {t("shelter.verified")}
          </p>
        )}
        <p className="mt-3 flex gap-6 border-t border-line pt-3 text-sm text-ink-muted">
          <span>{t.rich("shelters.seekingStat", { count: shelter.seeking_count, b: bold })}</span>
          <span>{t.rich("shelters.adoptedStat", { count: shelter.adopted_count, b: bold })}</span>
        </p>
      </div>
    </Card>
  );
}
