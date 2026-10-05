import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getUnreadCount } from "@/entities/conversation/server";
import { getSession, isCurator } from "@/entities/user";
import { routing } from "@/shared/i18n";
import { fontVariables } from "@/shared/styles";
import { SiteFooter } from "@/widgets/site-footer";
import { MobileTabBar, SiteHeader } from "@/widgets/site-header";
import "../globals.css";
import { Providers } from "./providers";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [user, t] = await Promise.all([getSession(), getTranslations("layout")]);
  const [curator, unread] = user
    ? await Promise.all([isCurator(user), getUnreadCount()])
    : [false, 0];

  return (
    <html lang={locale} className={`${fontVariables} h-full`}>
      <body className="flex min-h-full flex-col pb-16 md:pb-0">
        <NextIntlClientProvider>
          <Providers>
            <a
              href="#main"
              className="sr-only z-50 rounded-sm bg-surface-raised px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            >
              {t("skipToContent")}
            </a>
            <SiteHeader user={user} isCurator={curator} unread={unread} />
            <main id="main" className="flex flex-1 flex-col">
              {children}
            </main>
            <SiteFooter />
            <MobileTabBar signedIn={Boolean(user)} unread={unread} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
