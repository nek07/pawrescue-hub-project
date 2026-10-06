"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ModResult } from "../api/actions";

/** Действие модератора: подтверждение, ожидание, ошибка и обновление списка */
export function useModAction() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ModResult>, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return { run, pending, error };
}
