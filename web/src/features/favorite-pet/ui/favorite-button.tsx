"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Link, usePathname } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { toggleFavorite } from "../api/toggle-favorite";

type FavoriteButtonProps = {
  petId: string;
  petName: string;
  favorite: boolean;
  signedIn: boolean;
  /** icon — круглая кнопка на карточке, label — «В избранное» на странице питомца */
  variant?: "icon" | "label";
  className?: string;
};

/** Избранное. Гость видит кнопку, но она ведёт на вход. */
export function FavoriteButton({
  petId,
  petName,
  favorite,
  signedIn,
  variant = "icon",
  className,
}: FavoriteButtonProps) {
  const t = useTranslations("favorite");
  const pathname = usePathname();
  const [state, setState] = useState(favorite);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, startTransition] = useTransition();

  const label = optimistic ? t("remove", { name: petName }) : t("add", { name: petName });
  const icon = (
    <Heart aria-hidden className={cn("size-4 text-primary", optimistic && "fill-current")} />
  );
  const content =
    variant === "icon" ? (
      icon
    ) : (
      <>
        {icon}
        {optimistic ? t("saved") : t("save")}
      </>
    );
  const size = variant === "icon" ? "icon" : "md";

  if (!signedIn) {
    return (
      <Button asChild variant="secondary" size={size} className={className}>
        <Link href={{ pathname: "/login", query: { next: pathname } }} aria-label={label}>
          {content}
        </Link>
      </Button>
    );
  }

  const toggle = () =>
    startTransition(async () => {
      setOptimistic(!state);
      const result = await toggleFavorite(petId, !state);
      if (result.ok) setState(result.favorite);
    });

  return (
    <Button
      variant="secondary"
      size={size}
      aria-pressed={optimistic}
      aria-label={variant === "icon" ? label : undefined}
      onClick={toggle}
      className={className}
    >
      {content}
    </Button>
  );
}
