"use client";

import { Check, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/shared/ui";

/** Системное «Поделиться» на телефоне, копирование ссылки — на десктопе. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("sharePet");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => null);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Button variant="secondary" className={className} onClick={share}>
      {copied ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <Share2 aria-hidden className="size-4" />
      )}
      <span aria-live="polite">{copied ? t("copied") : t("share")}</span>
    </Button>
  );
}
