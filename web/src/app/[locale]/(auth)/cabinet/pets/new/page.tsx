import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCurating, requireSession } from "@/entities/user";
import { PetForm } from "@/features/manage-pet";
import { Link, redirect, type Locale } from "@/shared/i18n";
import { SectionHeader } from "@/shared/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cabinet"))("newPetTitle"), robots: { index: false } };
}

export default async function NewPetPage({ params }: PageProps<"/[locale]/cabinet/pets/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireSession("/cabinet/pets/new");
  const [t, curating] = await Promise.all([getTranslations("cabinet"), getCurating(user)]);
  if (!curating.volunteer && curating.shelters.length === 0) {
    redirect({ href: "/cabinet", locale: locale as Locale });
  }

  return (
    <div className="page-container flex max-w-3xl flex-col gap-6 py-10">
      <nav className="text-sm text-ink-muted">
        <Link href="/cabinet" className="underline">
          {t("title")}
        </Link>
      </nav>
      <SectionHeader as="h1" title={t("newPetTitle")}>
        <p className="text-ink-muted">{t("newPetLead")}</p>
      </SectionHeader>
      <PetForm mode="create" curating={curating} />
    </div>
  );
}
