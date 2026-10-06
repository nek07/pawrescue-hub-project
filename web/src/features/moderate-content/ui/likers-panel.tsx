"use client";

import { X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Avatar, Badge, Button } from "@/shared/ui";
import { getLikers, removeLike } from "../api/actions";
import type { LikeTarget, Liker } from "../model/types";
import { ModError } from "./mod-error";

/** Кто поставил лайк; модератор снимает накрученные по одному */
export function LikersPanel({
  target,
  id,
  onChange,
}: {
  target: LikeTarget;
  id: string;
  onChange: (total: number) => void;
}) {
  const t = useTranslations("moderation.likes");
  const format = useFormatter();
  const [likers, setLikers] = useState<Liker[]>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void getLikers(target, id).then((result) => {
      if (!alive) return;
      if (result.ok) setLikers(result.items);
      else setError(result.error);
    });
    return () => {
      alive = false;
    };
  }, [target, id]);

  const remove = (userId: string) =>
    startTransition(async () => {
      setError(undefined);
      const result = await removeLike(target, id, userId);
      if (!result.ok) return setError(result.error);
      const next = (likers ?? []).filter((l) => l.account.id !== userId);
      setLikers(next);
      onChange(next.length);
    });

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface p-3">
      {!likers && !error && <p className="text-sm text-ink-muted">{t("loading")}</p>}
      {likers?.length === 0 && <p className="text-sm text-ink-muted">{t("empty")}</p>}
      {likers && likers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {likers.map((liker) => (
            <li key={liker.account.id} className="flex items-center gap-3 text-sm">
              <Avatar name={liker.account.name} src={liker.account.avatar_url} size="sm" />
              <span className="font-medium">{liker.account.name}</span>
              {liker.account.blocked && <Badge tone="neutral">{t("blocked")}</Badge>}
              <span className="text-ink-muted">
                {format.dateTime(new Date(liker.created_at), { dateStyle: "short" })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={pending}
                onClick={() => remove(liker.account.id)}
              >
                <X aria-hidden className="size-4" />
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ModError code={error} />
    </div>
  );
}
