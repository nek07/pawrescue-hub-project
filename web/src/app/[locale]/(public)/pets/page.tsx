import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { parsePetFilters, toPetSearchParams, type PetFilters } from "@/entities/pet";
import { getPets } from "@/entities/pet/server";
import { getSession } from "@/entities/user";
import { PetFiltersBar } from "@/features/filter-pets";
import type { Locale } from "@/shared/i18n";
import { SectionHeader } from "@/shared/ui";
import { PetCatalogResults, PetCatalogSkeleton } from "@/widgets/pet-grid";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return { title: t("metaTitle"), description: t("lead") };
}

export default async function PetsPage({ params, searchParams }: PageProps<"/[locale]/pets">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, filters] = await Promise.all([
    getTranslations("catalog"),
    searchParams.then(parsePetFilters),
  ]);

  return (
    <div className="page-container flex flex-col gap-6 py-10">
      <SectionHeader as="h1" eyebrow={t("eyebrow")} title={t("title")}>
        <p className="text-ink-muted">{t("lead")}</p>
      </SectionHeader>
      <PetFiltersBar value={filters} />
      {/* Новый key на каждый набор фильтров — при смене фильтров виден скелетон */}
      <Suspense key={toPetSearchParams(filters).toString()} fallback={<PetCatalogSkeleton />}>
        <Results filters={filters} />
      </Suspense>
    </div>
  );
}

async function Results({ filters }: { filters: PetFilters }) {
  const [page, user] = await Promise.all([getPets(filters), getSession()]);
  return <PetCatalogResults page={page} filters={filters} signedIn={Boolean(user)} />;
}
