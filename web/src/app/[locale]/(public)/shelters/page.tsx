import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Building2 } from "lucide-react";
import { parseShelterFilters, ShelterCard } from "@/entities/shelter";
import { getShelters } from "@/entities/shelter/server";
import { ShelterFiltersBar } from "@/features/filter-shelters";
import { Link, type Locale } from "@/shared/i18n";
import { Button, EmptyState, SectionHeader } from "@/shared/ui";
import { PartnerCta } from "@/widgets/partner-cta";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shelters");
  return { title: t("metaTitle"), description: t("lead") };
}

export default async function SheltersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/shelters">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const filters = parseShelterFilters(await searchParams);
  const [t, page] = await Promise.all([getTranslations("shelters"), getShelters(filters)]);

  return (
    <div className="page-container flex flex-col gap-6 py-10">
      <SectionHeader as="h1" eyebrow={t("eyebrow")} title={t("title")}>
        <p className="text-ink-muted">{t("lead")}</p>
      </SectionHeader>
      <ShelterFiltersBar value={filters} />

      {page.total === 0 ? (
        <EmptyState
          visual={<Building2 aria-hidden className="size-8" />}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild>
              <Link href="/shelters">{t("empty.reset")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <p role="status" className="text-sm">
            {t.rich("found", { count: page.total, b: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.items.map((shelter) => (
              <li key={shelter.id} className="flex">
                <ShelterCard shelter={shelter} />
              </li>
            ))}
          </ul>
        </>
      )}

      <PartnerCta variant="shelters" />
    </div>
  );
}
