"use client";

import { useCallback } from "react";
import { toPetSearchParams, type PetFilters } from "@/entities/pet";
import { useReplaceQuery } from "@/shared/lib";

export function useFiltersNavigation(value: PetFilters) {
  const { replaceQuery, isPending } = useReplaceQuery();

  const update = useCallback(
    // Любая смена фильтра возвращает к первой странице
    (patch: Partial<PetFilters>) =>
      replaceQuery(toPetSearchParams({ ...value, ...patch, limit: undefined })),
    [value, replaceQuery],
  );

  return { update, isPending };
}
