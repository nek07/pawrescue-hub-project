import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { APPLICATION_STATUS_LIST } from "@/entities/application";
import { getIncomingApplications } from "@/entities/application/server";
import { isCurator, requireSession } from "@/entities/user";
import type { Locale } from "@/shared/i18n";
import { EmptyState, SectionHeader } from "@/shared/ui";
import { ApplicationList, ApplicationsTabs, StatusFilter } from "@/widgets/applications-board";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("applications"))("metaTitle"), robots: { index: false } };
}

export default async function IncomingApplicationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/applications/incoming">) {
  setRequestLocale((await params).locale as Locale);
  const user = await requireSession("/applications/incoming");
  const raw = (await searchParams).status;
  const status = APPLICATION_STATUS_LIST.find((s) => s === raw);
  const [t, curator] = await Promise.all([
    getTranslations("applications.incoming"),
    isCurator(user),
  ]);

  const header = (
    <SectionHeader as="h1" title={t("title")}>
      <p className="text-ink-muted">{t("lead")}</p>
    </SectionHeader>
  );

  if (!curator) {
    return (
      <div className="page-container flex max-w-4xl flex-col gap-6 py-10">
        {header}
        <EmptyState
          visual={<Inbox aria-hidden className="size-8" />}
          title={t("notCuratorTitle")}
          description={t("notCuratorText")}
        />
      </div>
    );
  }

  const page = await getIncomingApplications({ status });

  return (
    <div className="page-container flex max-w-4xl flex-col gap-6 py-10">
      {header}
      <ApplicationsTabs active="incoming" showIncoming />
      <StatusFilter active={status} />
      <ApplicationList
        applications={page.items}
        empty={
          <EmptyState
            visual={<Inbox aria-hidden className="size-8" />}
            title={t("emptyTitle")}
            description={t("emptyText")}
          />
        }
      />
    </div>
  );
}
