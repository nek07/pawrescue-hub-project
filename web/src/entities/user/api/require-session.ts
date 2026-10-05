import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/shared/i18n";
import { getSession } from "./get-session";

/**
 * Для страниц из (auth). proxy.ts уже отсёк тех, у кого нет cookie;
 * здесь ловим просроченную или отозванную сессию.
 */
export async function requireSession(nextPath: string) {
  const user = await getSession();
  if (!user) {
    redirect({
      href: { pathname: "/login", query: { next: nextPath } },
      locale: await getLocale(),
    });
  }
  return user!;
}
