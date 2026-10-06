"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/shared/ui";
import type { LikeTarget } from "../model/types";
import { LikersPanel } from "./likers-panel";

/** Счётчик лайков; по нажатию — кто лайкнул */
export function LikeToggle({
  target,
  id,
  count,
}: {
  target: LikeTarget;
  id: string;
  count: number;
}) {
  const t = useTranslations("moderation.likes");
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(count);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        disabled={total === 0 && !open}
        onClick={() => setOpen((v) => !v)}
      >
        <Heart aria-hidden className="size-4" />
        {t("count", { count: total })}
      </Button>
      {open && (
        <div className="basis-full">
          <LikersPanel target={target} id={id} onChange={setTotal} />
        </div>
      )}
    </>
  );
}
