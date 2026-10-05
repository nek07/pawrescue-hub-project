import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Building2 } from "lucide-react";
import { parseShelterFilters, ShelterCard } from "@/entities/shelter";
import { getShelters } from "@/entities/shelter/server";
import { getSession } from "@/entities/user";
import { ShelterFiltersBar } from "@/features/filter-shelters";
import { SubscribeButton } from "@/features/subscribe-shelter";
import { Link, type Locale } from "@/shared/i18n";
import { Button, EmptyState } from "@/shared/ui";
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
  const [t, page, user] = await Promise.all([
    getTranslations("shelters"),
    getShelters(filters),
    getSession(),
  ]);

  return (
    <div className="page-container flex flex-col gap-4 py-6 sm:gap-6 sm:py-8">
      {/* Компактная шапка, как в каталоге питомцев */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl leading-tight font-semibold sm:text-3xl">
          {t("title")}
        </h1>
        <p className="hidden text-sm text-ink-muted sm:block">{t("lead")}</p>
      </div>
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
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {page.items.map((shelter) => (
              <li key={shelter.id} className="flex">
                <ShelterCard
                  shelter={shelter}
                  action={
                    shelter.type === "shelter" && (
                      <SubscribeButton
                        shelterId={shelter.id}
                        subscribed={shelter.subscribed}
                        signedIn={Boolean(user)}
                        size="sm"
                      />
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <PartnerCta variant="shelters" />
    </div>
  );
}
