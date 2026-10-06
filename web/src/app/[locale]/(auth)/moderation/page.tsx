import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/entities/user";
import {
  ModCommentRow,
  ModPostRow,
  ModUserRow,
  VISIBILITIES,
  type Visibility,
} from "@/features/moderate-content";
import {
  getModComments,
  getModerationStats,
  getModPosts,
  getModUsers,
} from "@/features/moderate-content/server";
import type { Locale } from "@/shared/i18n";
import { firstValues } from "@/shared/lib";
import { SectionHeader } from "@/shared/ui";
import {
  MOD_TABS,
  ModFilters,
  ModList,
  ModStats,
  ModTabs,
  type ModQuery,
} from "@/widgets/moderation-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("moderation"))("metaTitle"), robots: { index: false } };
}

export default async function ModerationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/moderation">) {
  setRequestLocale((await params).locale as Locale);
  const user = await requireSession("/moderation");
  // Для остальных панели нет — не подсказываем, что она существует
  if (user.role !== "moderator") notFound();

  const raw = firstValues(await searchParams);
  const query: ModQuery = {
    tab: MOD_TABS.find((tab) => tab === raw.tab) ?? "overview",
    visibility: VISIBILITIES.find((v) => v === raw.visibility),
    q: raw.q?.trim().slice(0, 100) || undefined,
    post: raw.post,
    author: raw.author,
    blocked: raw.blocked === "true" ? "true" : undefined,
    cursor: raw.cursor,
  };
  const t = await getTranslations("moderation");

  return (
    <div className="page-container flex max-w-5xl flex-col gap-6 py-10">
      <SectionHeader as="h1" title={t("title")}>
        <p className="text-ink-muted">{t("lead")}</p>
      </SectionHeader>
      <ModTabs active={query.tab} />
      {await renderTab(query, t)}
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"moderation">>>;

async function renderTab(query: ModQuery, t: T) {
  const visibility = query.visibility as Visibility | undefined;
  const visibilityOptions = VISIBILITIES.map((v) => ({
    key: v,
    label: t(`filters.${v}`),
    query: { visibility: v === "all" ? undefined : v },
  }));

  switch (query.tab) {
    case "overview":
      return <ModStats stats={await getModerationStats()} />;

    case "posts": {
      const page = await getModPosts({
        visibility,
        q: query.q,
        author_id: query.author,
        cursor: query.cursor,
      });
      return (
        <>
          <ModFilters
            query={query}
            options={visibilityOptions}
            active={visibility ?? "all"}
            placeholder={t("filters.searchPosts")}
          />
          <ModList
            query={query}
            total={page.total}
            nextCursor={page.next_cursor}
            empty={page.items.length === 0}
          >
            {page.items.map((post) => (
              <ModPostRow key={post.id} post={post} />
            ))}
          </ModList>
        </>
      );
    }

    case "comments": {
      const page = await getModComments({
        visibility,
        q: query.q,
        post_id: query.post,
        author_id: query.author,
        cursor: query.cursor,
      });
      return (
        <>
          <ModFilters
            query={query}
            options={visibilityOptions}
            active={visibility ?? "all"}
            placeholder={t("filters.searchComments")}
          />
          <ModList
            query={query}
            total={page.total}
            nextCursor={page.next_cursor}
            empty={page.items.length === 0}
          >
            {page.items.map((comment) => (
              <ModCommentRow key={comment.id} comment={comment} />
            ))}
          </ModList>
        </>
      );
    }

    case "users": {
      const page = await getModUsers({
        q: query.q,
        blocked: query.blocked ? true : undefined,
        cursor: query.cursor,
      });
      return (
        <>
          <ModFilters
            query={query}
            options={[
              { key: "all", label: t("filters.allUsers"), query: { blocked: undefined } },
              { key: "blocked", label: t("filters.blocked"), query: { blocked: "true" } },
            ]}
            active={query.blocked ? "blocked" : "all"}
            placeholder={t("filters.searchUsers")}
          />
          <ModList
            query={query}
            total={page.total}
            nextCursor={page.next_cursor}
            empty={page.items.length === 0}
          >
            <ul className="flex flex-col gap-3">
              {page.items.map((u) => (
                <ModUserRow key={u.id} user={u} />
              ))}
            </ul>
          </ModList>
        </>
      );
    }
  }
}
