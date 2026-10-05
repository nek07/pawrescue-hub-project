import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { storyParagraphs } from "@/entities/pet";
import { getPet } from "@/entities/pet/server";
import { getSession } from "@/entities/user";
import { Link, type Locale } from "@/shared/i18n";
import { SectionHeader } from "@/shared/ui";
import { PetGrid } from "@/widgets/pet-grid";
import {
  AdoptionProcess,
  PetApplyBar,
  PetCurator,
  PetGallery,
  PetStory,
  PetSummary,
} from "@/widgets/pet-profile";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pets/[id]">): Promise<Metadata> {
  const pet = await getPet((await params).id);
  return pet
    ? { title: `${pet.name} — Paw Rescue Hub`, description: storyParagraphs(pet.story)[0] }
    : {};
}

export default async function PetPage({ params }: PageProps<"/[locale]/pets/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const pet = await getPet(id);
  if (!pet) notFound();

  const [t, user] = await Promise.all([getTranslations("petProfile"), getSession()]);
  const others = pet.similar.slice(0, 4);

  return (
    <div className="page-container flex flex-col gap-10 pt-6 pb-36 md:pb-12">
      <nav aria-label={t("breadcrumbs")} className="text-sm text-ink-muted">
        <Link href="/pets" className="underline">
          {(await getTranslations("nav"))("pets")}
        </Link>
        {" · "}
        <Link href={`/pets?kind=${pet.kind}`} className="underline">
          {t(`kindPlural.${pet.kind}`)}
        </Link>
        {" · "}
        <span aria-current="page">{pet.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <PetGallery pet={pet} />
        <div className="flex flex-col gap-4">
          <PetSummary pet={pet} signedIn={Boolean(user)} />
          <PetCurator pet={pet} />
          <AdoptionProcess />
        </div>
      </div>

      <PetStory pet={pet} />

      {others.length > 0 && (
        <section className="flex flex-col gap-6">
          <SectionHeader
            title={t("similar")}
            action={
              <Link href="/pets" className="text-sm font-semibold text-primary hover:underline">
                {t("catalogLink")} →
              </Link>
            }
          />
          <PetGrid pets={others} />
        </section>
      )}

      <PetApplyBar pet={pet} />
    </div>
  );
}
