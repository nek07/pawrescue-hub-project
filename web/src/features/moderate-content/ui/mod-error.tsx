"use client";

import { useTranslations } from "next-intl";

export function ModError({ code }: { code?: string }) {
  const t = useTranslations("moderation.errors");
  if (!code) return null;
  const known = t.has(code as "server_unavailable");
  return (
    <p role="alert" className="text-sm text-danger">
      {t(known ? (code as "server_unavailable") : "server_unavailable")}
    </p>
  );
}
