import "server-only";
import { cookies } from "next/headers";

/** Пробрасывает cookie браузера в запрос к API с сервера Next. */
export async function sessionHeaders() {
  return { cookie: (await cookies()).toString() };
}
