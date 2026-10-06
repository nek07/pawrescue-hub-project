"use client";

import { Ban, Eye, EyeOff, Trash2, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui";
import { setUserBlocked, type ModResult } from "../api/actions";
import type { ModPost } from "../model/types";
import { useModAction } from "../model/use-mod-action";
import { ModError } from "./mod-error";

/** Скрыть/вернуть, удалить навсегда, заблокировать автора — общее для постов и комментариев */
export function ContentActions({
  hidden,
  account,
  onHide,
  onDelete,
  deleteConfirm,
  children,
}: {
  hidden: boolean;
  account: ModPost["account"];
  onHide: (hidden: boolean) => Promise<ModResult>;
  onDelete: () => Promise<ModResult>;
  deleteConfirm: string;
  /** Лайки и ссылки — слева от кнопок */
  children?: ReactNode;
}) {
  const t = useTranslations("moderation.actions");
  const { run, pending, error } = useModAction();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {children}
        <div className="ml-auto flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => onHide(!hidden))}
          >
            {hidden ? (
              <Eye aria-hidden className="size-4" />
            ) : (
              <EyeOff aria-hidden className="size-4" />
            )}
            {hidden ? t("unhide") : t("hide")}
          </Button>
          {account.role !== "moderator" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => setUserBlocked(account.id, !account.blocked),
                  account.blocked ? undefined : t("blockConfirm", { name: account.name }),
                )
              }
            >
              {account.blocked ? (
                <UserCheck aria-hidden className="size-4" />
              ) : (
                <Ban aria-hidden className="size-4" />
              )}
              {account.blocked ? t("unblockAuthor") : t("blockAuthor")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger"
            disabled={pending}
            onClick={() => run(onDelete, deleteConfirm)}
          >
            <Trash2 aria-hidden className="size-4" />
            {t("delete")}
          </Button>
        </div>
      </div>
      <ModError code={error} />
    </div>
  );
}
