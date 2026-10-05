import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/entities/user";
import { DevLoginForm, GoogleLoginButton, TelegramLoginButton } from "@/features/auth-by-provider";
import { Link, redirect, type Locale } from "@/shared/i18n";
import { cn, firstValues, safeNextPath } from "@/shared/lib";
import { Card, ErrorState } from "@/shared/ui";

const BENEFITS = ["applications", "messages", "favorites"] as const;
const LOGIN_ERRORS = [
  "provider_not_configured",
  "google_failed",
  "google_email_unverified",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("login"))("metaTitle"), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const query = firstValues(await searchParams);
  const partner = query.as === "partner";
  // Приют после входа сразу попадает в подключение
  const next = safeNextPath(query.next, partner ? "/onboarding" : "/");

  // В dev-режиме страница входа открыта и вошедшим — чтобы переключаться между тестовыми аккаунтами
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== "1" && (await getSession())) {
    redirect({ href: next, locale: locale as Locale });
  }

  const t = await getTranslations("login");
  const roleHref = (as?: string) => ({
    pathname: "/login",
    query: { ...(as && { as }), ...(query.next && { next: query.next }) },
  });

  return (
    <div className="page-container grid gap-10 py-12 md:grid-cols-[1.2fr_1fr] md:items-start md:py-16">
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-lg text-ink-muted">{t("lead")}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {BENEFITS.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <Check aria-hidden className="size-4 text-success" />
              {t(`benefits.${key}`)}
            </li>
          ))}
        </ul>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <nav
          aria-label={t("roleLabel")}
          className="grid grid-cols-2 gap-1 rounded-pill bg-surface-sunken/60 p-1"
        >
          {(
            [
              ["adopter", undefined],
              ["partner", "partner"],
            ] as const
          ).map(([role, as]) => {
            const active = (role === "partner") === partner;
            return (
              <Link
                key={role}
                href={roleHref(as)}
                replace
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-pill px-3 py-2 text-center text-sm",
                  active
                    ? "bg-surface-raised font-semibold shadow-sm"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {t(`role.${role}`)}
              </Link>
            );
          })}
        </nav>
        {/* Бэкенд возвращает сюда с ?error=<код>, если вход через Google не удался */}
        {query.error && (
          <ErrorState
            title={t(`errors.${LOGIN_ERRORS.find((code) => code === query.error) ?? "unknown"}`)}
          />
        )}
        <TelegramLoginButton next={next} locale={locale as Locale} />
        <GoogleLoginButton next={`/${locale}${next === "/" ? "" : next}`} />
        {process.env.NEXT_PUBLIC_DEV_LOGIN === "1" && <DevLoginForm next={next} />}
        <p className="text-sm text-ink-muted">{t("note")}</p>
        <p className="text-sm text-ink-muted">
          {t.rich("terms", {
            rules: (chunks) => (
              <Link href="/rules" className="text-primary underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="text-primary underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </Card>
    </div>
  );
}
