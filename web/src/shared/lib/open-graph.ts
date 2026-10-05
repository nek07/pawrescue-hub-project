import type { Metadata } from "next";

const OG_LOCALES: Record<string, string> = { ru: "ru_RU", kk: "kk_KZ" };

/** Адрес сайта для абсолютных ссылок в превью (og:image, og:url) */
export function siteUrl() {
  return new URL(process.env.SITE_URL ?? "http://localhost:3000");
}

/**
 * Мета-теги превью ссылки для страницы. Next заменяет openGraph страницы целиком,
 * поэтому каждая страница передаёт и общие поля (сайт, язык). Картинку
 * добавляет opengraph-image.tsx соответствующего сегмента.
 */
export function openGraph({
  siteName,
  title,
  description,
  locale,
  type = "website",
}: {
  siteName: string;
  title: string;
  description?: string | null;
  locale: string;
  type?: "website" | "article" | "profile";
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type,
      siteName,
      locale: OG_LOCALES[locale] ?? OG_LOCALES.ru,
      title,
      description: description ?? undefined,
    },
    twitter: { card: "summary_large_image", title, description: description ?? undefined },
  };
}
