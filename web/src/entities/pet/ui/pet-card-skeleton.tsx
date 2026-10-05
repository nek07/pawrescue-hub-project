import { Skeleton } from "@/shared/ui";

export function PetCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <Skeleton className="aspect-[4/5] rounded-md sm:aspect-square" />
      <div className="flex flex-col gap-2 px-0.5 pt-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
