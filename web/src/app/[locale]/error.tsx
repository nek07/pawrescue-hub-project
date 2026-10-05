"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button, ErrorState } from "@/shared/ui";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("states.error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-container py-16">
      <ErrorState
        className="mx-auto max-w-md"
        title={t("title")}
        description={t("description")}
        action={
          <Button variant="secondary" size="sm" onClick={retry}>
            {t("retry")}
          </Button>
        }
      />
    </div>
  );
}
