import { useTranslations } from "next-intl";
import { PetCardSkeleton } from "@/entities/pet";
import { Skeleton } from "@/shared/ui";

export function PetCatalogSkeleton() {
  const t = useTranslations("states");

  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-56 rounded-pill" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <PetCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
