import { getTranslations } from "next-intl/server";
import { parsePetFilters } from "@/entities/pet";
import { getPets } from "@/entities/pet/server";
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

/** Приюты и волонтёры: их подопечные на мозаике и отметка о проверке */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, shelter, pets] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "shelters" }),
    getTranslations({ locale: locale as Locale, namespace: "shelter" }),
    getPets(parsePetFilters({})).catch(() => null),
  ]);
  const covers = (pets?.items ?? [])
    .map((p) => p.cover_url)
    .filter(Boolean)
    .slice(3, 6);
  const photos = await Promise.all(covers.map((c) => photoDataUri(c, { width: 440, height: 466 })));
  return renderOg(
    <OgFrame siteName={SITE_NAME}>
      <OgSplit photos={photos}>
        <OgText title={t("title")} text={t("lead")} />
        <OgBadge tone="success">{shelter("verified")}</OgBadge>
      </OgSplit>
    </OgFrame>,
  );
}
