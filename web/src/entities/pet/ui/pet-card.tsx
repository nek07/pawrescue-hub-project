import { MapPin, Mars, PawPrint, Venus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { getPetAge } from "../model/age";
import type { Pet } from "../model/pet";
import { StatusBadge } from "./status-badge";

type PetCardProps = {
  pet: Pet;
  /** Слот в правом верхнем углу фото: ♡ «В избранное» */
  favorite?: ReactNode;
  className?: string;
};

/**
 * Карточка-фото: вся карточка — ссылка (растянута с имени), кнопок нет.
 * Статус показываем только когда он отличается от обычного «Ищет дом»,
 * отметку «проверен» — на странице питомца: в каталоге она у всех.
 */
export function PetCard({ pet, favorite, className }: PetCardProps) {
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

  const SexIcon = pet.sex === "female" ? Venus : Mars;

  return (
    <article className={cn("group relative flex w-full flex-col", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-surface-sunken sm:aspect-square">
        {pet.cover_url ? (
          // Размеры нарезает бэкенд, оптимизация next/image не нужна
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.cover_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-xs text-ink-muted">
            <PawPrint aria-hidden className="size-8 text-surface-raised" />
            {t("pet.photoPlaceholder")}
          </div>
        )}
        {pet.status !== "seeking" && (
          <StatusBadge
            status={pet.status}
            sex={pet.sex}
            className="absolute top-3 left-3 rounded-pill px-2.5 py-1 shadow-sm"
          />
        )}
        {favorite && <div className="absolute top-2 right-2 z-10">{favorite}</div>}
      </div>

      <div className="flex flex-col gap-0.5 px-0.5 pt-3">
        <div className="flex items-center gap-1.5">
          <h3 className="min-w-0 truncate font-display text-lg leading-snug font-semibold">
            <Link
              href={`/pets/${pet.id}`}
              className="group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 after:absolute after:-inset-1 after:rounded-md focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ink"
            >
              {pet.name}
            </Link>
          </h3>
          <SexIcon
            role="img"
            aria-label={t("pet.sex", { sex: pet.sex })}
            className="size-4 shrink-0 text-ink-muted"
          />
        </div>
        <p className="line-clamp-2 text-sm text-ink-muted">{facts.join(" · ")}</p>
        <p className="mt-1 flex min-w-0 items-center gap-1 text-sm">
          <MapPin aria-hidden className="size-3.5 shrink-0 text-ink-muted" />
          <span className="truncate">
            <span className="font-semibold">{t(`cities.${pet.city}`)}</span>
            <span className="text-ink-muted">
              {" · "}
              {t("pet.curator", { kind: pet.curator.type, name: pet.curator.name })}
            </span>
          </span>
        </p>
      </div>
    </article>
  );
}
