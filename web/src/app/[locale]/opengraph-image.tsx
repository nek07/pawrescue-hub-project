import { getTranslations } from "next-intl/server";
import type { Locale } from "@/shared/i18n";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  OgSplit,
  OgText,
  photoDataUri,
  renderOg,
} from "@/shared/og";
import { SITE_NAME } from "@/shared/ui";

// Превью по умолчанию — для главной и всех страниц без своей карточки
export const alt = SITE_NAME;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "home" });
  const photo = await photoDataUri("/home/kitten.webp", { width: 440, height: 466 });
  return renderOg(
    <OgFrame siteName={SITE_NAME}>
      <OgSplit photos={[photo]}>
        <OgText eyebrow={t("eyebrow")} title={t("title")} text={t("lead")} />
      </OgSplit>
    </OgFrame>,
  );
}
