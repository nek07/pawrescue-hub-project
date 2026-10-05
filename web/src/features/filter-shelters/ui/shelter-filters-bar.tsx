"use client";

import { Search } from "lucide-react";
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
import { Input, Select } from "@/shared/ui";

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
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <form
        role="search"
        className="flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: query.trim() || undefined });
        }}
      >
        {/* Подписи видны только скринридеру: лупа и плейсхолдер говорят сами */}
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-muted"
          />
          <Input
            type="search"
            aria-label={t("search")}
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-pill bg-surface-raised pr-4 pl-10"
          />
        </div>
      </form>
      {HAS_CITY_CHOICE && (
        <Select
          aria-label={t("city")}
          value={value.city ?? ""}
          onChange={(event) => update({ city: CITIES.find((c) => c === event.target.value) })}
          className="rounded-pill pl-4 sm:w-48"
        >
          <option value="">{t("allCities")}</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {tCity(city)}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label={t("kind")}
        value={value.type ?? ""}
        onChange={(event) => update({ type: (event.target.value || undefined) as ShelterKind })}
        className="rounded-pill pl-4 sm:w-56"
      >
        <option value="">{t("kindAny")}</option>
        {SHELTER_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`kindOption.${kind}`)}
          </option>
        ))}
      </Select>
    </section>
  );
}
