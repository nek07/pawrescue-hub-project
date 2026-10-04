import { useTranslations } from "next-intl";
import { storyParagraphs, type PetDetails } from "@/entities/pet";

export function PetStory({ pet }: { pet: PetDetails }) {
  const t = useTranslations();
  const paragraphs = storyParagraphs(pet.story);
  if (paragraphs.length === 0 && pet.traits.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      {paragraphs.length > 0 && (
        <>
          <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
            {t("petProfile.story")}
          </p>
          {pet.story_title && (
            <h2 className="font-display text-3xl font-semibold">{pet.story_title}</h2>
          )}
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="font-display text-lg leading-relaxed">
              {paragraph}
            </p>
          ))}
        </>
      )}
      {pet.traits.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">{t("petProfile.traits")}</h3>
          <ul className="flex flex-wrap gap-2">
            {pet.traits.map((trait) => (
              <li
                key={trait}
                className="rounded-pill border border-line bg-surface-raised px-4 py-1.5 text-sm first-letter:uppercase"
              >
                {t(`pet.trait.${trait}`, { sex: pet.sex })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
