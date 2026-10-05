import { useTranslations } from "next-intl";
import { getPetAge, type Pet } from "@/entities/pet";
import { type ShelterListItem, ShelterLink } from "@/entities/shelter";
import { SubscribeButton } from "@/features/subscribe-shelter";
import { Link } from "@/shared/i18n";
import { Card } from "@/shared/ui";

/** Правая колонка ленты: «Ищут дом рядом» и приюты */
export function FeedSidebar({
  pets,
  shelters,
  signedIn,
}: {
  pets: Pet[];
  shelters: ShelterListItem[];
  signedIn: boolean;
}) {
  const t = useTranslations();

  return (
    <aside className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-semibold">{t("feed.nearby.title")}</h2>
        <ul className="flex flex-col gap-3">
          {pets.map((pet) => {
            const age = getPetAge(pet.birth_date);
            return (
              <li key={pet.id} className="relative flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-12 shrink-0 overflow-hidden rounded-sm bg-surface-sunken"
                >
                  {pet.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pet.cover_url} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="flex flex-col">
                  <Link
                    href={`/pets/${pet.id}`}
                    className="font-semibold after:absolute after:inset-0"
                  >
                    {pet.name}
                  </Link>
                  <span className="text-xs text-ink-muted">
                    {t("pet.kind", { kind: pet.kind, sex: pet.sex })} ·{" "}
                    {t(`pet.age.${age.unit}`, { count: age.count })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/pets" className="text-sm font-semibold text-primary hover:underline">
          {t("feed.nearby.catalog")} →
        </Link>
      </Card>

      {shelters.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t("feed.shelters.title")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {shelters.map((shelter) => (
              <li key={shelter.id} className="flex items-center justify-between gap-2">
                <span className="relative">
                  <ShelterLink type={shelter.type} id={shelter.id}>
                    {t("shelter.name", { kind: shelter.type, name: shelter.name })}
                  </ShelterLink>
                </span>
                <SubscribeButton
                  shelterId={shelter.id}
                  subscribed={shelter.subscribed}
                  signedIn={signedIn}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </aside>
  );
}
