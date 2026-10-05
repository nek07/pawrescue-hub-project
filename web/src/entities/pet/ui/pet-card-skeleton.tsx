import { Card, Skeleton } from "@/shared/ui";

export function PetCardSkeleton() {
  return (
    <Card aria-hidden>
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-2 h-10 rounded-pill" />
      </div>
    </Card>
  );
}
