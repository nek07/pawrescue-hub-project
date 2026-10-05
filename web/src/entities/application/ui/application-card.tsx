import { Check, PawPrint } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Card } from "@/shared/ui";
import { APPLICATION_STATUSES, isClosed, type Application } from "../model/application";
import { ApplicationStatusBadge } from "./application-status-badge";

const STEPS = ["sent", "meeting", "approved", "completed"] as const;

type ApplicationCardProps = {
  application: Application;
  /** Слот для кнопок смены статуса */
  actions?: ReactNode;
};

/**
 * Заявка глазами заявителя или куратора (viewer_role приходит с бэкенда).
 * Куратор видит анкету человека; телефон — только после одобрения.
 */
export function ApplicationCard({ application, actions }: ApplicationCardProps) {
  const t = useTranslations();
  const format = useFormatter();
  const { pet, status } = application;
  const isCurator = application.viewer_role === "curator";
  const currentStep = APPLICATION_STATUSES[status].step;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-sunken">
        {pet.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <PawPrint aria-hidden className="size-6 text-surface-raised" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold">
              <Link href={`/pets/${pet.id}`} className="hover:underline">
                {pet.name}
              </Link>
            </h2>
            <p className="text-sm text-ink-muted">
              {isCurator
                ? t("application.from", { name: application.name })
                : t("pet.curator", { kind: pet.curator.type, name: pet.curator.name })}
              {" · "}
              {format.dateTime(new Date(application.created_at), {
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <ApplicationStatusBadge status={status} />
        </div>

        {!isClosed(status) && (
          <ol
            aria-label={t("application.progress")}
            className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
          >
            {STEPS.map((step, index) => {
              const done = index <= currentStep;
              return (
                <li
                  key={step}
                  aria-current={index === currentStep ? "step" : undefined}
                  className={cn("flex items-center gap-1.5", done ? "text-ink" : "text-ink-muted")}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border",
                      done ? "border-success bg-success text-on-primary" : "border-line",
                    )}
                  >
                    {done && <Check className="size-3" />}
                  </span>
                  {t(`application.status.${step}`)}
                </li>
              );
            })}
          </ol>
        )}

        {isCurator && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Fact label={t("applyForPet.fields.phone")}>
              {application.phone ?? t("application.phoneHidden")}
            </Fact>
            <Fact label={t("applyForPet.fields.city")}>{t(`cities.${application.city}`)}</Fact>
            <Fact label={t("applyForPet.fields.housing")}>
              {t(`applyForPet.fields.housingOption.${application.housing}`)}
            </Fact>
            <Fact label={t("applyForPet.fields.household")}>
              {application.household.length > 0
                ? application.household
                    .map((h) => t(`applyForPet.fields.householdOption.${h}`))
                    .join(", ")
                : t("application.nobody")}
            </Fact>
            {application.about && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-muted">{t("application.about")}</dt>
                <dd className="whitespace-pre-line">{application.about}</dd>
              </div>
            )}
          </dl>
        )}

        {actions}
      </div>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
