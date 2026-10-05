import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PawPrint } from "lucide-react";
import { getPets } from "@/entities/pet/server";
import { getPosts } from "@/entities/post/server";
import { getShelter } from "@/entities/shelter/server";
import { getSession } from "@/entities/user";
import { Link, type Locale } from "@/shared/i18n";
import { EmptyState } from "@/shared/ui";
import { FeedList } from "@/widgets/feed-list";
import { PetGrid } from "@/widgets/pet-grid";
import {
  SHELTER_TABS,
  ShelterAbout,
  ShelterChecks,
  ShelterHeader,
  ShelterTabs,
  type ShelterTab,
} from "@/widgets/shelter-profile";

type Props = PageProps<"/[locale]/shelters/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shelter = await getShelter((await params).id);
  return shelter
    ? { title: `${shelter.name} — Paw Rescue Hub`, description: shelter.about ?? undefined }
    : {};
}

export default async function ShelterPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const shelter = await getShelter(id);
  if (!shelter) notFound();

  const { tab: rawTab } = await searchParams;
  const tab: ShelterTab = SHELTER_TABS.find((value) => value === rawTab) ?? "pets";
  const [t, user] = await Promise.all([getTranslations(), getSession()]);

  return (
    <div className="page-container flex flex-col gap-6 py-6">
      <nav aria-label={t("petProfile.breadcrumbs")} className="text-sm text-ink-muted">
        <Link href="/shelters" className="underline">
          {t("nav.shelters")}
        </Link>
        {" · "}
        <span aria-current="page">
          {t("shelter.name", { kind: "shelter", name: shelter.name })}
        </span>
      </nav>

      <ShelterHeader shelter={shelter} signedIn={Boolean(user)} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <ShelterTabs shelterId={shelter.id} active={tab} />
          {tab === "pets" && <ShelterPets shelterId={shelter.id} />}
          {tab === "feed" && <ShelterFeed shelterId={shelter.id} />}
          {tab === "about" && <ShelterAbout shelter={shelter} />}
        </div>
        <aside className="flex flex-col gap-4">
          <ShelterChecks shelter={shelter} />
        </aside>
      </div>
    </div>
  );
}

async function ShelterPets({ shelterId }: { shelterId: string }) {
  const [t, page] = await Promise.all([
    getTranslations("shelterProfile.noPets"),
    getPets({ shelter_id: shelterId }),
  ]);
  if (page.total === 0) {
    return (
      <EmptyState
        visual={<PawPrint aria-hidden className="size-8" />}
        title={t("title")}
        description={t("description")}
      />
    );
  }
  return <PetGrid pets={page.items} columns={3} />;
}

async function ShelterFeed({ shelterId }: { shelterId: string }) {
  const [user, page] = await Promise.all([getSession(), getPosts({ shelter_id: shelterId })]);
  return <FeedList query={{ shelter_id: shelterId }} initialPage={page} signedIn={Boolean(user)} />;
}
