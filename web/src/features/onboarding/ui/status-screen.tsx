"use client";

import { BadgeCheck, CircleX, Hourglass } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Button, buttonVariants, EmptyState } from "@/shared/ui";
import type { Onboarding } from "../model/steps";

type StatusScreenProps = { request: Onboarding; onRestart: () => void };

/** Заявка отправлена: ждёт модератора, одобрена или отклонена */
export function StatusScreen({ request, onRestart }: StatusScreenProps) {
  const t = useTranslations("onboarding.status");
  const format = useFormatter();
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "long" }) : "";

  switch (request.status) {
    case "submitted":
      return (
        <EmptyState
          visual={<Hourglass aria-hidden className="size-8" />}
          title={t("submittedTitle")}
          description={t("submittedText", { date: date(request.submitted_at) })}
          action={
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>
              {t("home")}
            </Link>
          }
        />
      );

    case "approved":
      return (
        <EmptyState
          visual={<BadgeCheck aria-hidden className="size-8 text-success" />}
          title={request.type === "shelter" ? t("approvedShelter") : t("approvedVolunteer")}
          description={t("approvedText")}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/cabinet" className={buttonVariants()}>
                {t("cabinet")}
              </Link>
              {request.shelter_id && (
                <Link
                  href={`/shelters/${request.shelter_id}`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  {t("shelterPage")}
                </Link>
              )}
            </div>
          }
        />
      );

    default:
      return (
        <EmptyState
          visual={<CircleX aria-hidden className="size-8 text-danger" />}
          title={t("rejectedTitle")}
          description={
            <>
              {t("rejectedText", { date: date(request.decided_at) })}
              {request.reject_reason && (
                <span className="mt-3 block rounded-sm bg-surface-sunken p-3 text-left whitespace-pre-line text-ink">
                  {request.reject_reason}
                </span>
              )}
            </>
          }
          action={<Button onClick={onRestart}>{t("restart")}</Button>}
        />
      );
  }
}
