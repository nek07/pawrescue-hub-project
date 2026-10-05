"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Link, usePathname } from "@/shared/i18n";
import { Button } from "@/shared/ui";
import { toggleSubscription } from "../api/toggle-subscription";

type SubscribeButtonProps = {
  shelterId: string;
  subscribed: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
};

/** Подписка на приют: его посты появятся в ленте. Гость попадает на вход. */
export function SubscribeButton({
  shelterId,
  subscribed,
  signedIn,
  size = "md",
}: SubscribeButtonProps) {
  const t = useTranslations("subscribe");
  const pathname = usePathname();
  const [state, setState] = useState(subscribed);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button asChild variant="secondary" size={size}>
        <Link href={{ pathname: "/login", query: { next: pathname } }}>{t("subscribe")}</Link>
      </Button>
    );
  }

  const toggle = () =>
    startTransition(async () => {
      setOptimistic(!state);
      const result = await toggleSubscription(shelterId, !state);
      if (result.ok) setState(result.subscribed);
    });

  return (
    <Button variant="secondary" size={size} aria-pressed={optimistic} onClick={toggle}>
      {optimistic && <Check aria-hidden className="size-4" />}
      {optimistic ? t("subscribed") : t("subscribe")}
    </Button>
  );
}
