import { getTranslations } from "next-intl/server";
import { parsePetFilters } from "@/entities/pet";
import { getPets } from "@/entities/pet/server";
import { getShelter } from "@/entities/shelter/server";
import type { Locale } from "@/shared/i18n";
import {
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

/** Профиль приюта: его питомцы на мозаике, сколько ищут дом и отметка о проверке */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, shelter, pets] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "shelter" }),
    getShelter(id).catch(() => null),
    getPets(parsePetFilters({ shelter_id: id })).catch(() => null),
  ]);
  if (!shelter) {
    return renderOg(
      <OgFrame siteName={SITE_NAME}>
        <OgSplit photos={[]}>
          <OgText title={SITE_NAME} />
        </OgSplit>
      </OgFrame>,
    );
  }

  const covers = (pets?.items ?? [])
    .map((p) => p.cover_url)
    .filter(Boolean)
    .slice(0, 3);
  const photos = await Promise.all(covers.map((c) => photoDataUri(c, { width: 440, height: 466 })));
  return renderOg(
    <OgFrame siteName={SITE_NAME}>
      <OgSplit photos={photos}>
        <OgText
          eyebrow={t("kind", { kind: "shelter" })}
          title={shelter.name}
          text={shelter.about}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <OgBadge>{t("seeking", { count: shelter.seeking_count })}</OgBadge>
          {shelter.verified && <OgBadge tone="success">{t("verified")}</OgBadge>}
        </div>
      </OgSplit>
    </OgFrame>,
  );
}
