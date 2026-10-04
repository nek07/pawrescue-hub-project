import Form from "next/form";
import { useLocale, useTranslations } from "next-intl";
import { PET_KINDS } from "@/entities/pet";
import { CITIES } from "@/shared/config";
import { getPathname } from "@/shared/i18n";
import { Button, Select } from "@/shared/ui";

/** Поиск с главной: обычная GET-форма в каталог, работает и без JavaScript. */
export function QuickSearchForm({ defaultCity }: { defaultCity?: string }) {
  const t = useTranslations("filterPets");
  const tCity = useTranslations("cities");
  const locale = useLocale();

  return (
    <Form
      action={getPathname({ href: "/pets", locale })}
      className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-2 sm:flex-row sm:rounded-pill"
    >
      <label className="sr-only" htmlFor="quick-kind">
        {t("quick.kind")}
      </label>
      <Select
        id="quick-kind"
        name="kind"
        defaultValue=""
        className="rounded-pill border-0 bg-surface sm:w-44"
      >
        <option value="">{t("quick.kindAny")}</option>
        {PET_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`quick.kindOption.${kind}`)}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="quick-city">
        {t("city")}
      </label>
      <Select
        id="quick-city"
        name="city"
        defaultValue={defaultCity ?? ""}
        className="rounded-pill border-0 bg-surface sm:w-44"
      >
        <option value="">{t("allCities")}</option>
        {CITIES.map((city) => (
          <option key={city} value={city}>
            {tCity(city)}
          </option>
        ))}
      </Select>
      <Button type="submit" className="sm:flex-1">
        {t("quick.submit")}
      </Button>
    </Form>
  );
}
