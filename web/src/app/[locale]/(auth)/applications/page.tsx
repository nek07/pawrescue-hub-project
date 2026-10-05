import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyApplications } from "@/entities/application";
import { isCurator, requireSession } from "@/entities/user";
import { Link, type Locale } from "@/shared/i18n";
import { Button, EmptyState, SectionHeader } from "@/shared/ui";
import { ApplicationList, ApplicationsTabs } from "@/widgets/applications-board";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("applications"))("metaTitle"), robots: { index: false } };
}

export default async function MyApplicationsPage({ params }: PageProps<"/[locale]/applications">) {
  setRequestLocale((await params).locale as Locale);
  const user = await requireSession("/applications");
  const [t, page, curator] = await Promise.all([
    getTranslations("applications.mine"),
    getMyApplications(),
    isCurator(user),
  ]);

  return (
    <div className="page-container flex max-w-4xl flex-col gap-6 py-10">
      <SectionHeader as="h1" title={t("title")}>
        <p className="text-ink-muted">{t("lead")}</p>
      </SectionHeader>
      <ApplicationsTabs active="mine" showIncoming={curator} />
      <ApplicationList
        applications={page.items}
        empty={
          <EmptyState
            visual={<FileText aria-hidden className="size-8" />}
            title={t("emptyTitle")}
            description={t("emptyText")}
            action={
              <Button asChild>
                <Link href="/pets">{t("emptyAction")}</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
