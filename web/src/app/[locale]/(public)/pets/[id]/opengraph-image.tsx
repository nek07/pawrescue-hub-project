import { getTranslations } from "next-intl/server";
import { getPetAge, storyParagraphs } from "@/entities/pet";
import { getPet } from "@/entities/pet/server";
import type { Locale } from "@/shared/i18n";
import {
  OG,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgBadge,
  OgFrame,
  OgSplit,
  OgText,
  photoDataUri,
  renderOg,
} from "@/shared/og";
import { SITE_NAME } from "@/shared/ui";

export const alt = SITE_NAME;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Анкета: фото, кличка, «Кошка · 4 года», статус и куратор — как карточка на сайте */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, pet] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "pet" }),
    getPet(id).catch(() => null),
  ]);
  if (!pet) {
    // Анкету сняли — превью всё равно должно быть фирменным, а не пустым
    return renderOg(
      <OgFrame siteName={SITE_NAME}>
        <OgSplit photos={[]}>
          <OgText title={SITE_NAME} />
        </OgSplit>
      </OgFrame>,
    );
  }

  const age = getPetAge(pet.birth_date);
  const facts = [
    t("kind", { kind: pet.kind, sex: pet.sex }),
    t(`age.${age.unit}`, { count: age.count }),
    pet.sterilized ? t("sterilized", { sex: pet.sex }) : null,
  ].filter(Boolean);
  const photo = await photoDataUri(pet.photos[0]?.url ?? pet.cover_url, {
    width: 440,
    height: 466,
  });

  return renderOg(
    <OgFrame siteName={SITE_NAME}>
      <OgSplit photos={[photo]}>
        <OgBadge tone={pet.status === "adopted" ? "success" : "accent"}>
          {t(`status.${pet.status}`, { sex: pet.sex })}
        </OgBadge>
        <OgText eyebrow={facts.join(" · ")} title={pet.name} text={storyParagraphs(pet.story)[0]} />
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: OG.muted }}>
          {t("curator", { kind: pet.curator.type, name: pet.curator.name })}
          {pet.curator.verified ? ` · ${t("verified", { kind: pet.curator.type })}` : ""}
        </div>
      </OgSplit>
    </OgFrame>,
  );
}
