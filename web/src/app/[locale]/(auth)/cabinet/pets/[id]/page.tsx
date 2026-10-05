import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getManagedPet } from "@/entities/pet/server";
import { requireSession } from "@/entities/user";
import { StatusPanel } from "@/features/change-pet-status";
import { PetForm, toPetFormValues } from "@/features/manage-pet";
import { PhotoManager } from "@/features/manage-pet-photos";
import { Link, type Locale } from "@/shared/i18n";
import { SectionHeader } from "@/shared/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cabinet"))("editTitle"), robots: { index: false } };
}

export default async function EditPetPage({ params }: PageProps<"/[locale]/cabinet/pets/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requireSession(`/cabinet/pets/${id}`);
  const [t, pet] = await Promise.all([getTranslations("cabinet"), getManagedPet(id)]);
  if (!pet) notFound();

  return (
    <div className="page-container flex max-w-3xl flex-col gap-6 py-10">
      <nav className="text-sm text-ink-muted">
        <Link href="/cabinet" className="underline">
          {t("title")}
        </Link>
      </nav>
      <SectionHeader as="h1" title={pet.name} />
      <StatusPanel petId={pet.id} status={pet.status} sex={pet.sex} />
      <PhotoManager petId={pet.id} photos={pet.photos} />
      <PetForm mode="edit" petId={pet.id} defaults={toPetFormValues(pet)} />
    </div>
  );
}
