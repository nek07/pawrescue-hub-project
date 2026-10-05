"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  SHELTER_KINDS,
  toShelterSearchParams,
  type ShelterFilters,
  type ShelterKind,
} from "@/entities/shelter";
import { CITIES, HAS_CITY_CHOICE } from "@/shared/config";
import { useReplaceQuery } from "@/shared/lib";
import { Field, Input, Select } from "@/shared/ui";

const SEARCH_DELAY_MS = 350;

export function ShelterFiltersBar({ value }: { value: ShelterFilters }) {
  const t = useTranslations("filterShelters");
  const tCity = useTranslations("cities");
  const { replaceQuery, isPending } = useReplaceQuery();
  const [query, setQuery] = useState(value.q ?? "");

  const update = (patch: Partial<ShelterFilters>) =>
    replaceQuery(toShelterSearchParams({ ...value, ...patch }));

  useEffect(() => {
    if (query.trim() === (value.q ?? "")) return;
    const timer = setTimeout(
      () => replaceQuery(toShelterSearchParams({ ...value, q: query.trim() || undefined })),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [query, value, replaceQuery]);

  return (
    <section
      aria-label={t("label")}
      aria-busy={isPending || undefined}
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
    >
      <form
        role="search"
        className="flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: query.trim() || undefined });
        }}
      >
        <Field label={t("search")}>
          <Input
            type="search"
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-pill bg-surface-raised px-4"
          />
        </Field>
      </form>
      {HAS_CITY_CHOICE && (
        <Field label={t("city")} className="sm:w-48">
          <Select
            value={value.city ?? ""}
            onChange={(event) => update({ city: CITIES.find((c) => c === event.target.value) })}
            className="rounded-pill pl-4"
          >
            <option value="">{t("allCities")}</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {tCity(city)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("kind")} className="sm:w-56">
        <Select
          value={value.type ?? ""}
          onChange={(event) => update({ type: (event.target.value || undefined) as ShelterKind })}
          className="rounded-pill pl-4"
        >
          <option value="">{t("kindAny")}</option>
          {SHELTER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kindOption.${kind}`)}
            </option>
          ))}
        </Select>
      </Field>
    </section>
  );
}
