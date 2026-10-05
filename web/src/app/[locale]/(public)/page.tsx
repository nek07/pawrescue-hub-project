import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPets } from "@/entities/pet/server";
import { StoryCard } from "@/entities/post";
import { getPosts } from "@/entities/post/server";
import { ShelterMiniCard } from "@/entities/shelter";
import { getShelters } from "@/entities/shelter/server";
import { Link, type Locale } from "@/shared/i18n";
import { SectionHeader } from "@/shared/ui";
import { HomeHero } from "@/widgets/home-hero";
import { HowItWorks } from "@/widgets/how-it-works";
import { PartnerCta } from "@/widgets/partner-cta";
import { PetGrid } from "@/widgets/pet-grid";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale); // локаль уже проверена в layout

  const [t, pets, stories, shelters] = await Promise.all([
    getTranslations("home"),
    getPets({ limit: 4 }),
    getPosts({ kind: "story", limit: 3 }),
    getShelters({ type: "shelter" }),
  ]);

  return (
    <>
      <HomeHero />
      <section className="page-container flex flex-col gap-6 py-12">
        <SectionHeader
          eyebrow={t("pets.eyebrow")}
          title={t("pets.title")}
          action={<MoreLink href="/pets">{t("pets.link")}</MoreLink>}
        />
        <PetGrid pets={pets.items} showCity />
      </section>
      <HowItWorks />
      {stories.items.length > 0 && (
        <section className="page-container flex flex-col gap-6 py-12">
          <SectionHeader
            eyebrow={t("stories.eyebrow")}
            title={t("stories.title")}
            action={<MoreLink href="/feed">{t("stories.link")}</MoreLink>}
          />
          <ul className="grid gap-4 md:grid-cols-3">
            {stories.items.map((post) => (
              <li key={post.id} className="flex">
                <StoryCard post={post} href="/feed" />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="page-container flex flex-col gap-6 py-12">
        <SectionHeader
          eyebrow={t("shelters.eyebrow")}
          title={t("shelters.title")}
          action={<MoreLink href="/shelters">{t("shelters.link")}</MoreLink>}
        />
        <ul className="grid gap-4 md:grid-cols-3">
          {shelters.items.slice(0, 3).map((shelter) => (
            <li key={shelter.id} className="flex flex-col">
              <ShelterMiniCard shelter={shelter} />
            </li>
          ))}
        </ul>
      </section>
      <PartnerCta />
    </>
  );
}

function MoreLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}
