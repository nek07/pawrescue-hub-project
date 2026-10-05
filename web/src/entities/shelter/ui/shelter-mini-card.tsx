import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, Card } from "@/shared/ui";
import type { ShelterListItem } from "../model/shelter";
import { ShelterLink } from "./shelter-link";
import { HAS_CITY_CHOICE } from "@/shared/config";

/** Компактная карточка для главной: аватар, город и сколько питомцев ищут дом. */
export function ShelterMiniCard({ shelter }: { shelter: ShelterListItem }) {
  const t = useTranslations();

  return (
    <Card className="relative flex w-full items-center gap-4 p-4 transition-shadow focus-within:shadow-md hover:shadow-md">
      <Avatar name="" src={shelter.avatar_url} size="lg" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="font-semibold">
          <ShelterLink type={shelter.type} id={shelter.id}>
            {t("shelter.name", { kind: shelter.type, name: shelter.name })}
          </ShelterLink>
        </h3>
        <p className="text-sm text-ink-muted">
          {HAS_CITY_CHOICE && shelter.city && `${t(`cities.${shelter.city}`)} · `}
          {t("shelter.seeking", { count: shelter.seeking_count })}
        </p>
        {shelter.verified && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <Check aria-hidden className="size-4" />
            {t("shelter.verified")}
          </p>
        )}
      </div>
    </Card>
  );
}
