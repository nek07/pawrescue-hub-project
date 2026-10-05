import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPet, isOpenForApplications, PetCard } from "@/entities/pet";
import { requireSession } from "@/entities/user";
import { ApplyForm } from "@/features/apply-for-pet";
import { Link, type Locale } from "@/shared/i18n";
import { Button, EmptyState } from "@/shared/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("applyForPet"))("metaTitle"), robots: { index: false } };
}

export default async function ApplyPage({ params }: PageProps<"/[locale]/pets/[id]/apply">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireSession(`/pets/${id}/apply`);
  const pet = await getPet(id);
  if (!pet) notFound();

  const t = await getTranslations();

  if (!isOpenForApplications(pet.status)) {
    return (
      <div className="page-container py-16">
        <EmptyState
          className="mx-auto max-w-md"
          title={t("applyForPet.closed.title")}
          description={t("applyForPet.closed.description")}
          action={
            <Button asChild>
              <Link href="/pets">{t("applyForPet.closed.action")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const steps = ["read", "answer", "meet"] as const;

  return (
    <div className="page-container flex flex-col gap-6 py-6">
      <nav aria-label={t("petProfile.breadcrumbs")} className="text-sm text-ink-muted">
        <Link href="/pets" className="underline">
          {t("nav.pets")}
        </Link>
        {" · "}
        <Link href={`/pets/${pet.id}`} className="underline">
          {pet.name}
        </Link>
        {" · "}
        <span aria-current="page">{t("applyForPet.breadcrumb")}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl font-semibold">{t("applyForPet.title")}</h1>
            <p className="max-w-xl text-ink-muted">
              {t("applyForPet.lead", {
                curator: t("petProfile.curatorName", {
                  kind: pet.curator.type,
                  name: pet.curator.name,
                }),
              })}
            </p>
          </div>
          <ApplyForm petId={pet.id} defaultName={user.name} defaultCity={pet.city} />
        </div>

        <aside className="flex flex-col gap-4 lg:order-last">
          <PetCard pet={pet} />
          <section className="rounded-sm bg-accent p-5 text-on-accent">
            <h2 className="font-semibold">{t("applyForPet.next.title")}</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {steps.map((step) => (
                <li key={step}>{t(`applyForPet.next.${step}`)}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
