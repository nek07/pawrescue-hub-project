"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter } from "@/shared/i18n";

/**
 * Заменяет query-строку текущей страницы без прокрутки и записи в историю.
 * Фильтры живут в URL — ими можно поделиться ссылкой.
 */
export function useReplaceQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const replaceQuery = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  return { replaceQuery, isPending };
}
