import { Check, PawPrint } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/shared/i18n";
import { Card } from "@/shared/ui";
import { getPetAge } from "../model/age";
import type { Pet } from "../model/pet";
import { StatusBadge } from "./status-badge";
import { HAS_CITY_CHOICE } from "@/shared/config";

type PetCardProps = {
  pet: Pet;
  /** На главной показываем город, в каталоге он уже выбран в фильтре */
  showCity?: boolean;
  /** Слот для действий: «Подробнее», избранное */
  actions?: ReactNode;
};

/** Вся карточка кликабельна: ссылка на имени растянута на карточку. */
export function PetCard({ pet, showCity = false, actions }: PetCardProps) {
  const t = useTranslations();
  const age = getPetAge(pet.birth_date);
  const highlight = pet.traits[0]
    ? t(`pet.trait.${pet.traits[0]}`, { sex: pet.sex })
    : pet.sterilized
      ? t("pet.sterilized", { sex: pet.sex })
      : null;

  const facts = [
    t("pet.kind", { kind: pet.kind, sex: pet.sex }),
    t(`pet.age.${age.unit}`, { count: age.count }),
    highlight,
  ].filter(Boolean);

  const curator = t("pet.curator", { kind: pet.curator.type, name: pet.curator.name });

  return (
    <Card className="relative flex w-full flex-col transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-surface-sunken text-xs text-ink-muted">
        {pet.cover_url ? (
          // Размеры нарезает бэкенд, оптимизация next/image не нужна
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.cover_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <PawPrint aria-hidden className="size-6 text-surface-raised" />
            {t("pet.photoPlaceholder")}
          </>
        )}
        <StatusBadge status={pet.status} sex={pet.sex} className="absolute top-3 left-3" />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-display text-lg font-semibold">
          <Link
            href={`/pets/${pet.id}`}
            className="after:absolute after:inset-0 after:rounded-sm focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ink"
          >
            {pet.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-muted">{facts.join(" · ")}</p>
        <p className="text-sm text-ink-muted">
          {showCity && HAS_CITY_CHOICE ? `${t(`cities.${pet.city}`)} · ${curator}` : curator}
        </p>
        {pet.curator.verified && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-success">
            <Check aria-hidden className="size-4" />
            {t("pet.verified", { kind: pet.curator.type })}
          </p>
        )}
        {actions && <div className="relative z-10 mt-auto flex gap-2 pt-3">{actions}</div>}
      </div>
    </Card>
  );
}
