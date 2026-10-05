import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPets } from "@/entities/pet/server";
import { FEED_CATEGORIES } from "@/entities/post";
import { getPosts } from "@/entities/post/server";
import { getShelters } from "@/entities/shelter/server";
import { getSession } from "@/entities/user";
import type { Locale } from "@/shared/i18n";
import { FeedCategories, FeedGuestBanner, FeedList, FeedSidebar } from "@/widgets/feed-list";
import { openGraph } from "@/shared/lib";
import { SITE_NAME } from "@/shared/ui";

export async function generateMetadata({ params }: PageProps<"/[locale]/feed">): Promise<Metadata> {
  const { locale } = await params;
  const [t, home] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "feed" }),
    getTranslations({ locale: locale as Locale, namespace: "home" }),
  ]);
  return {
    title: t("metaTitle"),
    description: home("lead"),
    ...openGraph({ siteName: SITE_NAME, title: home("title"), description: home("lead"), locale }),
  };
}

export default async function FeedPage({ params, searchParams }: PageProps<"/[locale]/feed">) {
  setRequestLocale((await params).locale as Locale);
  const raw = (await searchParams).category;
  const category = FEED_CATEGORIES.find((c) => c === raw) ?? "all";

  const [t, user, page, pets, shelters] = await Promise.all([
    getTranslations("feed"),
    getSession(),
    getPosts({ category }),
    getPets({ limit: 3 }),
    getShelters({ type: "shelter" }),
  ]);

  return (
    <div className="page-container grid gap-6 py-8 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
      <FeedCategories active={category} />
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
        {!user && <FeedGuestBanner />}
        <FeedList key={category} query={{ category }} initialPage={page} signedIn={Boolean(user)} />
      </div>
      <FeedSidebar
        pets={pets.items}
        shelters={shelters.items.slice(0, 3)}
        signedIn={Boolean(user)}
      />
    </div>
  );
}
