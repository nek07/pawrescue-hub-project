import { PawPrint, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { getPetAge, StatusBadge, type Pet } from "@/entities/pet";
import { Link } from "@/shared/i18n";

/** Анкеты куратора строками: обложка, статус, факты и переход к правке. */
export function CabinetPetList({ pets, empty }: { pets: Pet[]; empty: ReactNode }) {
  const t = useTranslations();
  if (pets.length === 0) return <>{empty}</>;

  return (
    <ul className="flex flex-col gap-3">
      {pets.map((pet) => {
        const age = getPetAge(pet.birth_date);
        return (
          <li key={pet.id}>
            <Link
              href={`/cabinet/pets/${pet.id}`}
              className="group flex items-center gap-4 rounded-sm border border-line bg-surface-raised p-3 transition-shadow hover:shadow-md focus-visible:shadow-md"
            >
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-sunken">
                {pet.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pet.cover_url} alt="" className="size-full object-cover" />
                ) : (
                  <PawPrint aria-hidden className="size-6 text-ink-muted" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-lg font-semibold">{pet.name}</span>
                  <StatusBadge status={pet.status} sex={pet.sex} />
                </div>
                <p className="truncate text-sm text-ink-muted">
                  {t("pet.kind", { kind: pet.kind, sex: pet.sex })} ·{" "}
                  {t(`pet.age.${age.unit}`, { count: age.count })} ·{" "}
                  {t("pet.curator", { kind: pet.curator.type, name: pet.curator.name })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm text-primary group-hover:underline">
                <Pencil aria-hidden className="size-4" />
                <span className="max-sm:sr-only">{t("cabinet.edit")}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
