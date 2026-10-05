"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type ReactNode } from "react";
import { countHiddenFilters, PET_AGES, PET_KINDS, type PetFilters } from "@/entities/pet";
import { CITIES, HAS_CITY_CHOICE } from "@/shared/config";
import { cn } from "@/shared/lib";
import { Button, Chip, Field, Input, Select } from "@/shared/ui";
import { useFiltersNavigation } from "../model/use-filters-navigation";

const FLAGS = ["sterilized", "good_with_kids", "needs_foster"] as const;
const SEARCH_DELAY_MS = 350;

export function PetFiltersBar({ value }: { value: PetFilters }) {
  const t = useTranslations("filterPets");
  const tCity = useTranslations("cities");
  const { update, isPending } = useFiltersNavigation(value);
  const [query, setQuery] = useState(value.q ?? "");
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const hiddenCount = countHiddenFilters(value);

  // Поиск применяется сам, когда человек перестал печатать
  useEffect(() => {
    if (query.trim() === (value.q ?? "")) return;
    const timer = setTimeout(() => update({ q: query.trim() || undefined }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, value.q, update]);

  return (
    <section
      aria-label={t("label")}
      aria-busy={isPending || undefined}
      className="rounded-sm border border-line bg-surface-raised p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
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
              className="rounded-pill bg-surface px-4"
            />
          </Field>
        </form>
        {HAS_CITY_CHOICE && (
          <Field label={t("city")} className="sm:w-56">
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
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="mt-4 md:hidden"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        {t("toggle")}
        {hiddenCount > 0 && (
          <span className="rounded-pill bg-primary px-1.5 text-xs text-on-primary">
            {hiddenCount}
          </span>
        )}
      </Button>

      <div
        id={panelId}
        className={cn("mt-4 flex-col gap-3", expanded ? "flex" : "hidden", "md:flex")}
      >
        <ChipGroup label={t("kind")}>
          <Chip pressed={!value.kind} onClick={() => update({ kind: undefined })}>
            {t("kindAny")}
          </Chip>
          {PET_KINDS.map((kind) => (
            <Chip key={kind} pressed={value.kind === kind} onClick={() => update({ kind })}>
              {t(`kindOption.${kind}`)}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label={t("age")}>
          <Chip pressed={!value.age} onClick={() => update({ age: undefined })}>
            {t("ageAny")}
          </Chip>
          {PET_AGES.map((age) => (
            <Chip key={age} pressed={value.age === age} onClick={() => update({ age })}>
              {t(`ageOption.${age}`)}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label={t("more")}>
          {FLAGS.map((flag) => (
            <Chip
              key={flag}
              pressed={Boolean(value[flag])}
              onClick={() => update({ [flag]: value[flag] ? undefined : true })}
            >
              {t(flag)}
            </Chip>
          ))}
        </ChipGroup>
      </div>
    </section>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <span id={id} className="text-sm font-semibold sm:w-24 sm:shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
