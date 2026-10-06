"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/shared/ui";
import type { ModPost } from "../model/types";

/** Кто на самом деле написал: пост «от приюта» пишет конкретный сотрудник */
export function AccountLine({ account }: { account: ModPost["account"] }) {
  const t = useTranslations("moderation");
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      {t("account", { name: account.name })}
      <Badge tone="neutral">{t(`role.${account.role}`)}</Badge>
      {account.blocked && <Badge tone="inverse">{t("blocked")}</Badge>}
    </p>
  );
}
