import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { SESSION_COOKIE } from "@/shared/config";
import { routing } from "@/shared/i18n";

const handleI18n = createMiddleware(routing);

/** Страницы группы (auth): без cookie сессии — на вход с возвратом обратно */
const PROTECTED = [
  /^\/pets\/[^/]+\/apply$/,
  /^\/messages(\/|$)/,
  /^\/applications(\/|$)/,
  /^\/favorites$/,
  /^\/cabinet(\/|$)/,
  /^\/onboarding$/,
  /^\/profile$/,
];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, locale, ...rest] = pathname.split("/");
  const path = `/${rest.join("/")}`;

  if (
    hasLocale(routing.locales, locale) &&
    PROTECTED.some((pattern) => pattern.test(path)) &&
    !request.cookies.has(SESSION_COOKIE)
  ) {
    const login = new URL(`/${locale}/login`, request.url);
    login.searchParams.set("next", path + search);
    return NextResponse.redirect(login);
  }

  return handleI18n(request);
}

export const config = {
  // Всё, кроме API, служебных путей Next и файлов с расширением
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
