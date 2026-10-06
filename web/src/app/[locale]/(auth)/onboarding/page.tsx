import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/entities/user";
import { OnboardingWizard } from "@/features/onboarding";
import { getMyOnboarding } from "@/features/onboarding/server";
import type { Locale } from "@/shared/i18n";
import { SectionHeader } from "@/shared/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("onboarding"))("metaTitle"), robots: { index: false } };
}

export default async function OnboardingPage({ params }: PageProps<"/[locale]/onboarding">) {
  setRequestLocale((await params).locale as Locale);
  await requireSession("/onboarding");
  const [t, request] = await Promise.all([getTranslations("onboarding"), getMyOnboarding()]);

  return (
    <div className="page-container flex max-w-3xl flex-col gap-6 py-10">
      <SectionHeader as="h1" title={t("title")}>
        <p className="text-ink-muted">{t("lead")}</p>
      </SectionHeader>
      <OnboardingWizard initial={request} />
    </div>
  );
}
