"use client";

import { Ban, UserCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Avatar, Badge, Button } from "@/shared/ui";
import { setUserBlocked } from "../api/actions";
import type { ModUser } from "../model/types";
import { useModAction } from "../model/use-mod-action";
import { ModError } from "./mod-error";

export function ModUserRow({ user }: { user: ModUser }) {
  const t = useTranslations("moderation");
  const format = useFormatter();
  const { run, pending, error } = useModAction();
  const blocked = user.blocked_at !== null;

  return (
    <li className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={user.name} src={user.avatar_url} size="sm" />
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{user.name}</span>
          <span className="text-xs text-ink-muted">
            {t("since", {
              date: format.dateTime(new Date(user.created_at), { dateStyle: "medium" }),
            })}
          </span>
        </div>
        <Badge tone="neutral">{t(`role.${user.role}`)}</Badge>
        {user.verified && <Badge tone="success">{t("verified")}</Badge>}
        {blocked && <Badge tone="inverse">{t("blocked")}</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-1 text-sm">
          <Link
            href={`/moderation?tab=posts&author=${user.id}`}
            className="px-2 text-primary underline"
          >
            {t("posts", { count: user.posts_count })}
          </Link>
          <Link
            href={`/moderation?tab=comments&author=${user.id}`}
            className="px-2 text-primary underline"
          >
            {t("comments", { count: user.comments_count })}
          </Link>
          {user.role !== "moderator" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => setUserBlocked(user.id, !blocked),
                  blocked ? undefined : t("actions.blockConfirm", { name: user.name }),
                )
              }
            >
              {blocked ? (
                <UserCheck aria-hidden className="size-4" />
              ) : (
                <Ban aria-hidden className="size-4" />
              )}
              {blocked ? t("actions.unblock") : t("actions.block")}
            </Button>
          )}
        </div>
      </div>
      <ModError code={error} />
    </li>
  );
}
