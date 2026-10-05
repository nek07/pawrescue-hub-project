import type { Metadata } from "next";
import { PawPrint, Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PET_STATUSES, type PetStatus } from "@/entities/pet";
import { getMyPets } from "@/entities/pet/server";
import { getCurating, requireSession } from "@/entities/user";
import { Link, type Locale } from "@/shared/i18n";
import { buttonVariants, EmptyState, SectionHeader } from "@/shared/ui";
import { CabinetPetList, PetStatusFilter } from "@/widgets/curator-cabinet";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cabinet"))("metaTitle"), robots: { index: false } };
}

export default async function CabinetPage({
  params,
  searchParams,
}: PageProps<"/[locale]/cabinet">) {
  setRequestLocale((await params).locale as Locale);
  const user = await requireSession("/cabinet");
  const raw = (await searchParams).status;
  const status = (Object.keys(PET_STATUSES) as PetStatus[]).find((s) => s === raw);
  const [t, curating] = await Promise.all([getTranslations("cabinet"), getCurating(user)]);
  const canCurate = curating.volunteer || curating.shelters.length > 0;

  if (!canCurate) {
    return (
      <div className="page-container flex max-w-4xl flex-col gap-6 py-10">
        <SectionHeader as="h1" title={t("title")} />
        <EmptyState
          visual={<PawPrint aria-hidden className="size-8" />}
          title={t("notCuratorTitle")}
          description={t("notCuratorText")}
        />
      </div>
    );
  }

  const pets = await getMyPets({ status });

  return (
    <div className="page-container flex max-w-4xl flex-col gap-6 py-10">
      <SectionHeader as="h1" title={t("title")}>
        <p className="text-ink-muted">
          {curating.shelters.length > 0
            ? t("leadShelter", { names: curating.shelters.map((s) => `«${s.name}»`).join(", ") })
            : t("leadVolunteer")}
        </p>
      </SectionHeader>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PetStatusFilter active={status} />
        <Link href="/cabinet/pets/new" className={buttonVariants()}>
          <Plus aria-hidden className="size-4" />
          {t("newPet")}
        </Link>
      </div>
      <CabinetPetList
        pets={pets.items}
        empty={
          <EmptyState
            visual={<PawPrint aria-hidden className="size-8" />}
            title={status ? t("emptyFiltered") : t("emptyTitle")}
            description={status ? undefined : t("emptyText")}
          />
        }
      />
    </div>
  );
}
