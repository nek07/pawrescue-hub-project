import { ArrowRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { getPetAge, isOpenForApplications, StatusBadge, type PetDetails } from "@/entities/pet";
import { FavoriteButton } from "@/features/favorite-pet";
import { ShareButton } from "@/features/share-pet";
import { StartChatButton } from "@/features/start-conversation";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Button, Card } from "@/shared/ui";
import { HAS_CITY_CHOICE } from "@/shared/config";

type Fact = { label: string; value: ReactNode; tone?: "success" | "warning" };

/** Карточка справа: статус, факты, «Хочу забрать», вопрос куратору. */
export function PetSummary({ pet, signedIn }: { pet: PetDetails; signedIn: boolean }) {
  const t = useTranslations();
  const format = useFormatter();
  const age = getPetAge(pet.birth_date);
  const open = isOpenForApplications(pet.status);

  const facts: Fact[] = (
    [
      { label: t("petProfile.facts.sex"), value: t("petProfile.facts.sexValue", { sex: pet.sex }) },
      pet.weight_kg !== null && {
        label: t("petProfile.facts.weight"),
        value: t("petProfile.facts.weightValue", { weight: pet.weight_kg }),
      },
      {
        label: t("petProfile.facts.sterilized"),
        value: pet.sterilized ? t("petProfile.facts.yes") : t("petProfile.facts.no"),
        tone: pet.sterilized ? ("success" as const) : undefined,
      },
      {
        label: t("petProfile.facts.vaccinated"),
        value: pet.vaccinated_at
          ? t("petProfile.facts.vaccinatedOn", {
              date: format.dateTime(new Date(pet.vaccinated_at), {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }),
            })
          : t("petProfile.facts.no"),
        tone: pet.vaccinated_at ? ("success" as const) : undefined,
      },
      {
        label: t("petProfile.facts.chip"),
        value: t(`petProfile.facts.chipValue.${pet.chip}`),
        tone: pet.chip === "planned" ? ("warning" as const) : undefined,
      },
      pet.litter_trained && {
        label: t("petProfile.facts.litter"),
        value: t("petProfile.facts.litterValue", { sex: pet.sex }),
      },
    ] as (Fact | false | null)[]
  ).filter((fact): fact is Fact => Boolean(fact));

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col items-start gap-2">
        <StatusBadge status={pet.status} sex={pet.sex} />
        <h1 className="font-display text-4xl font-semibold">{pet.name}</h1>
        <p className="text-ink-muted">
          {[
            t("pet.kind", { kind: pet.kind, sex: pet.sex }),
            t(`pet.age.${age.unit}`, { count: age.count }),
            HAS_CITY_CHOICE && t(`cities.${pet.city}`),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-ink-muted">{fact.label}</dt>
            <dd
              className={cn(
                "text-sm font-semibold",
                fact.tone === "success" && "text-success",
                fact.tone === "warning" && "text-warning",
              )}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="hidden flex-col gap-2 md:flex">
        <ApplyAction pet={pet} open={open} />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-ink-muted">{t("petProfile.question")}</span>
          <StartChatButton
            target={{ pet_id: pet.id }}
            signedIn={signedIn}
            variant="link"
            className="inline-flex items-center gap-1"
          >
            {t("petProfile.ask")}
            <ArrowRight aria-hidden className="size-4" />
          </StartChatButton>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <FavoriteButton
            petId={pet.id}
            petName={pet.name}
            favorite={pet.is_favorite}
            signedIn={signedIn}
            variant="label"
          />
          <ShareButton title={pet.name} />
        </div>
      </div>
    </Card>
  );
}

function ApplyAction({ pet, open }: { pet: PetDetails; open: boolean }) {
  const t = useTranslations("petProfile");

  if (!open) {
    // Недоступная кнопка всегда с причиной рядом — по листу «Состояния»
    return (
      <>
        <Button size="lg" disabled aria-describedby="apply-closed">
          {t("apply")}
        </Button>
        <p id="apply-closed" className="text-center text-sm text-ink-muted">
          {t("unavailable")}
        </p>
      </>
    );
  }

  return (
    <>
      <Button asChild size="lg">
        <Link href={`/pets/${pet.id}/apply`}>{t("apply")}</Link>
      </Button>
      <p className="text-center text-sm text-ink-muted">{t("applyHint")}</p>
    </>
  );
}

/** На телефоне кнопка заявки прилипает к низу экрана, над вкладками. */
export function PetApplyBar({ pet }: { pet: PetDetails }) {
  const t = useTranslations("petProfile");
  if (!isOpenForApplications(pet.status)) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface-raised px-4 py-3 md:hidden">
      <Button asChild size="lg" className="w-full">
        <Link href={`/pets/${pet.id}/apply`}>{t("apply")}</Link>
      </Button>
      <p className="mt-1 text-center text-xs text-ink-muted">{t("applyHintShort")}</p>
    </div>
  );
}
