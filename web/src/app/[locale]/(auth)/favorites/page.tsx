import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFavoritePets } from "@/entities/pet/server";
import { ShelterCard } from "@/entities/shelter";
import { getSubscriptions } from "@/entities/shelter/server";
import { requireSession } from "@/entities/user";
import { Link, type Locale } from "@/shared/i18n";
import { Button, EmptyState, SectionHeader } from "@/shared/ui";
import { PetGrid } from "@/widgets/pet-grid";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("favorites"))("metaTitle"), robots: { index: false } };
}

export default async function FavoritesPage({ params }: PageProps<"/[locale]/favorites">) {
  setRequestLocale((await params).locale as Locale);
  await requireSession("/favorites");
  const [t, pets, shelters] = await Promise.all([
    getTranslations("favorites"),
    getFavoritePets(),
    getSubscriptions(),
  ]);

  return (
    <div className="page-container flex flex-col gap-10 py-10">
      <SectionHeader as="h1" title={t("title")} />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold">{t("pets")}</h2>
        {pets.items.length > 0 ? (
          <PetGrid pets={pets.items} showCity />
        ) : (
          <EmptyState
            visual={<Heart aria-hidden className="size-8" />}
            title={t("emptyPets")}
            description={t("emptyPetsText")}
            action={
              <Button asChild>
                <Link href="/pets">{t("toCatalog")}</Link>
              </Button>
            }
          />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold">{t("shelters")}</h2>
        {shelters.items.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shelters.items.map((shelter) => (
              <li key={shelter.id} className="flex">
                <ShelterCard shelter={shelter} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={t("emptyShelters")}
            description={t("emptySheltersText")}
            action={
              <Button asChild variant="secondary">
                <Link href="/shelters">{t("toShelters")}</Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
