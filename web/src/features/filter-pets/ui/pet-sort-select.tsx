"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { PET_SORTS, type PetFilters, type PetSort } from "@/entities/pet";
import { Select } from "@/shared/ui";
import { useFiltersNavigation } from "../model/use-filters-navigation";

export function PetSortSelect({ value }: { value: PetFilters }) {
  const t = useTranslations("filterPets");
  const { update } = useFiltersNavigation(value);
  const id = useId();

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-sm font-semibold">
        {t("sort")}
      </label>
      <Select
        id={id}
        value={value.sort ?? "newest"}
        onChange={(event) => update({ sort: event.target.value as PetSort })}
        className="min-h-10 rounded-pill pl-4 text-sm"
      >
        {PET_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {t(`sortOption.${sort}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
