"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { StatusBadge, type PetSex, type PetStatus } from "@/entities/pet";
import { Link } from "@/shared/i18n";
import { Button, Chip, ErrorState } from "@/shared/ui";
import { deleteDraft, publishPet, setPetStatus, type StatusResult } from "../api/pet-status";

/** Статусы, которые куратор переключает сам (как MANUAL_STATUSES на бэкенде) */
const MANUAL: PetStatus[] = ["seeking", "needs_foster", "treatment"];

/**
 * Статус анкеты в кабинете: публикация черновика, ручные статусы, удаление.
 * «Забронирован» и «Нашёл дом» ставит заявка — здесь только пояснение.
 */
export function StatusPanel({
  petId,
  status,
  sex,
}: {
  petId: string;
  status: PetStatus;
  sex: PetSex;
}) {
  const t = useTranslations("cabinet.status");
  const tStatus = useTranslations("pet.status");
  const router = useRouter();
  const [result, setResult] = useState<StatusResult>();
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<StatusResult>) =>
    startTransition(async () => {
      const next = await action();
      setResult(next);
      if (next.ok) router.refresh();
    });

  const errorText = (code: string) =>
    t.has(`errors.${code}` as "errors.server_unavailable")
      ? t(`errors.${code}` as "errors.server_unavailable")
      : t("errors.server_unavailable");

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">{t("title")}</h2>
        <StatusBadge status={status} sex={sex} />
        {status !== "draft" && (
          <Link
            href={`/pets/${petId}`}
            className="ml-auto inline-flex items-center gap-1 text-sm text-primary underline"
          >
            {t("openPublic")}
            <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        )}
      </div>

      {status === "draft" && (
        <>
          <p className="text-sm text-ink-muted">{t("draftHint")}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" loading={pending} onClick={() => run(() => publishPet(petId))}>
              {t("publish")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => window.confirm(t("deleteConfirm")) && run(() => deleteDraft(petId))}
            >
              {t("deleteDraft")}
            </Button>
          </div>
        </>
      )}

      {MANUAL.includes(status) && (
        <div role="group" aria-label={t("manualLabel")} className="flex flex-col gap-2">
          <p className="text-sm text-ink-muted">{t("manualHint")}</p>
          <div className="flex flex-wrap gap-2">
            {MANUAL.map((value) => (
              <Chip
                key={value}
                pressed={value === status}
                disabled={pending}
                onClick={() => value !== status && run(() => setPetStatus(petId, value))}
              >
                {tStatus(value, { sex })}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {(status === "reserved" || status === "adopted") && (
        <p className="text-sm text-ink-muted">
          {t("byApplication")}{" "}
          <Link href="/applications/incoming" className="text-primary underline">
            {t("toApplications")}
          </Link>
        </p>
      )}

      {result && !result.ok && (
        <ErrorState
          title={errorText(result.error)}
          description={
            result.missing?.length
              ? t("missing", {
                  fields: result.missing
                    .map((f) => t(`missingField.${f}` as "missingField.story"))
                    .join(", "),
                })
              : undefined
          }
        />
      )}
    </section>
  );
}
