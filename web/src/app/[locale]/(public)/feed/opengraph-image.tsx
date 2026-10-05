import { getTranslations } from "next-intl/server";
import { getPosts } from "@/entities/post/server";
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

export const alt = SITE_NAME;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Лента: фото «до и после» из свежей истории */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, posts] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "home" }),
    getPosts({ category: "before_after" }).catch(() => null),
  ]);
  const story = posts?.items.find((p) => p.photos.length > 0);
  const sources = story ? story.photos.slice(0, 3).map((p) => p.url) : ["/home/tosha.webp"];
  const photos = await Promise.all(
    sources.map((s) => photoDataUri(s, { width: 440, height: 466 })),
  );
  return renderOg(
    <OgFrame siteName={SITE_NAME}>
      <OgSplit photos={photos}>
        <OgText eyebrow={t("eyebrow")} title={t("title")} text={t("lead")} />
      </OgSplit>
    </OgFrame>,
  );
}
