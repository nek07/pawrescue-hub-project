"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Link, routing, usePathname } from "@/shared/i18n";
import { cn } from "@/shared/lib";

function LocaleLinks({ query }: { query: string }) {
  const t = useTranslations("localeSwitcher");
  const current = useLocale();
  const pathname = usePathname();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <nav aria-label={t("label")}>
      <ul className="flex items-center gap-1.5 text-sm">
        {routing.locales.map((locale, index) => (
          <li key={locale} className="flex items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden className="text-ink-muted">
                ·
              </span>
            )}
            <Link
              href={href}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-label={t(`name.${locale}`)}
              aria-current={locale === current ? "true" : undefined}
              className={cn(
                "rounded-sm px-1 py-2",
                locale === current ? "font-semibold text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {t(`short.${locale}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function LocaleLinksWithQuery() {
  // Фильтры каталога живут в URL — при смене языка их сохраняем
  return <LocaleLinks query={useSearchParams().toString()} />;
}

export function LocaleSwitcher() {
  return (
    <Suspense fallback={<LocaleLinks query="" />}>
      <LocaleLinksWithQuery />
    </Suspense>
  );
}
