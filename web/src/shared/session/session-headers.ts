import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/shared/config";

/** Пробрасывает cookie браузера в запрос к API с сервера Next. */
export async function sessionHeaders() {
  return { cookie: (await cookies()).toString() };
}

/**
 * Опции fetch для данных, которые бэкенд персонализирует (избранное, подписки,
 * отметки): гостю — общий кэш, вошедшему — его cookie и без кэша, чтобы
 * чужие флаги не попали в общий кэш.
 */
export async function personalizedFetch(cache: { tags: string[]; revalidate: number }) {
  const store = await cookies();
  if (!store.has(SESSION_COOKIE)) return { next: cache };
  return { headers: { cookie: store.toString() }, cache: "no-store" as const };
}
