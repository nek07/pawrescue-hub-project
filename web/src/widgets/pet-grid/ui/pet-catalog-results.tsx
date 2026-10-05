import { PawPrint } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  PetCard,
  PETS_PAGE_SIZE,
  toPetSearchParams,
  type PetFilters,
  type PetPage,
} from "@/entities/pet";
import { PetSortSelect } from "@/features/filter-pets";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Button, buttonVariants, EmptyState } from "@/shared/ui";

/** Результаты каталога: счётчик, сортировка, сетка, пустое состояние и «Показать ещё». */
export function PetCatalogResults({ page, filters }: { page: PetPage; filters: PetFilters }) {
  const t = useTranslations();

  if (page.total === 0) {
    return (
      <EmptyState
        visual={<PawPrint aria-hidden className="size-8" />}
        title={t("catalog.empty.title")}
        description={t("catalog.empty.description")}
        action={
          <Button asChild>
            <Link href="/pets">{t("catalog.empty.reset")}</Link>
          </Button>
        }
      />
    );
  }

  const nextLimit = (filters.limit ?? PETS_PAGE_SIZE) + PETS_PAGE_SIZE;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm">
          {t.rich("catalog.found", {
            count: page.total,
            b: (chunks) => <strong>{chunks}</strong>,
          })}
          {filters.city && ` · ${t(`cities.${filters.city}`)}`}
        </p>
        <PetSortSelect value={filters} />
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {page.items.map((pet) => (
          <li key={pet.id} className="flex">
            <PetCard
              pet={pet}
              actions={
                // Вся карточка — ссылка; кнопка здесь только визуальная подсказка
                <span aria-hidden className={cn(buttonVariants(), "pointer-events-none flex-1")}>
                  {t("pet.more")}
                </span>
              }
            />
          </li>
        ))}
      </ul>

      {page.next_cursor && (
        <Button asChild variant="secondary" className="self-center">
          <Link
            href={`/pets?${toPetSearchParams({ ...filters, limit: nextLimit })}`}
            scroll={false}
          >
            {t("catalog.showMore")}
          </Link>
        </Button>
      )}
    </div>
  );
}
