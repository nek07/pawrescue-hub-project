import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { HAS_CITY_CHOICE } from "@/shared/config";
import { cn } from "@/shared/lib";
import { Avatar, Card } from "@/shared/ui";
import type { ShelterListItem } from "../model/shelter";
import { ShelterLink } from "./shelter-link";

/** Компактная карточка для главной: аватар, город и сколько питомцев ищут дом. */
export function ShelterMiniCard({ shelter }: { shelter: ShelterListItem }) {
  const t = useTranslations();
  const isShelter = shelter.type === "shelter";

  return (
    <Card className="relative flex w-full items-center gap-4 rounded-md p-4 transition-shadow focus-within:shadow-md hover:shadow-md">
      <span aria-hidden className="flex shrink-0">
        <Avatar
          name={shelter.name}
          src={shelter.avatar_url}
          size="lg"
          tone={isShelter ? "accent" : "ink"}
          className={cn(isShelter && "rounded-md")}
        />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="flex min-w-0 items-center gap-1.5 font-semibold">
          <span className="truncate">
            <ShelterLink type={shelter.type} id={shelter.id}>
              {t("shelter.name", { kind: shelter.type, name: shelter.name })}
            </ShelterLink>
          </span>
          {shelter.verified && (
            <BadgeCheck
              role="img"
              aria-label={t("shelter.verified")}
              className="size-4 shrink-0 text-success"
            />
          )}
        </h3>
        <p className="text-sm text-ink-muted">
          {HAS_CITY_CHOICE && shelter.city && `${t(`cities.${shelter.city}`)} · `}
          {t("shelter.seeking", { count: shelter.seeking_count })}
        </p>
      </div>
    </Card>
  );
}
