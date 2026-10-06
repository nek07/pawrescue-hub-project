"use client";

import { Check, FileText, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Link } from "@/shared/i18n";
import { Avatar, Badge, Button, Field, Textarea } from "@/shared/ui";
import { approveOnboarding, rejectOnboarding } from "../api/actions";
import type { ModOnboarding, ReviewStatus } from "../model/types";
import { useModAction } from "../model/use-mod-action";
import { ModError } from "./mod-error";

/**
 * Заявка приюта или волонтёра: всё, что заполнил человек, документы по
 * коротким ссылкам и решение — одобрить или отклонить с причиной.
 */
export function ModOnboardingRow({ request }: { request: ModOnboarding }) {
  const t = useTranslations("moderation.onboarding");
  const tCity = useTranslations("cities");
  const format = useFormatter();
  const { run, pending, error } = useModAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : "";
  const shelter = request.type === "shelter";
  const documents = request.documents.filter((d) => d.confirmed && d.view_url);
  const registration = documents.filter((d) => d.kind === "registration");
  const photos = documents.filter((d) => d.kind === "territory_photo");

  return (
    <li className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{request.name}</h2>
            <Badge tone="neutral">{t(`type.${request.type}`)}</Badge>
            <Badge
              tone={
                request.status === "approved"
                  ? "success"
                  : request.status === "rejected"
                    ? "inverse"
                    : "accent"
              }
            >
              {t(`status.${request.status as ReviewStatus}`)}
            </Badge>
          </div>
          <p className="text-xs text-ink-muted">
            {t("submitted", { date: date(request.submitted_at) })}
            {request.decided_at && ` · ${t("decided", { date: date(request.decided_at) })}`}
          </p>
        </div>
        {request.applicant && (
          <Link
            href={`/moderation?tab=users&q=${encodeURIComponent(request.applicant.name)}`}
            className="flex items-center gap-2 text-sm"
          >
            <Avatar name={request.applicant.name} src={request.applicant.avatar_url} size="sm" />
            <span className="flex flex-col">
              <span className="text-xs text-ink-muted">{t("applicant")}</span>
              <span className="underline">{request.applicant.name}</span>
            </span>
          </Link>
        )}
      </div>

      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
        <Row label={t("city")}>{request.city ? tCity(request.city) : "—"}</Row>
        <Row label={t("phone")}>
          {request.contact_phone ? (
            <a href={`tel:${request.contact_phone}`} className="text-primary underline">
              {request.contact_phone}
            </a>
          ) : (
            "—"
          )}
        </Row>
        <Row label={t("recommender")}>{request.recommender ?? "—"}</Row>
        {shelter && <Row label={t("address")}>{request.address ?? "—"}</Row>}
        {shelter && <Row label={t("visitHours")}>{request.visit_hours ?? "—"}</Row>}
        <Row label={t("about")}>
          {request.about ? <span className="whitespace-pre-line">{request.about}</span> : "—"}
        </Row>
      </dl>

      {shelter && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{t("registration")}</h3>
            {registration.length === 0 ? (
              <p className="text-sm text-danger">{t("noFiles")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {registration.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.view_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm hover:border-ink"
                    >
                      <FileText aria-hidden className="size-4 shrink-0" />
                      <span className="max-w-60 truncate">{doc.filename}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{t("photos", { count: photos.length })}</h3>
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((doc, index) => (
                  <li key={doc.id}>
                    <a
                      href={doc.view_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square overflow-hidden rounded-sm bg-surface-sunken"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doc.view_url!}
                        alt={t("photoAlt", { n: index + 1 })}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {documents.length > 0 && <p className="text-xs text-ink-muted">{t("linksExpire")}</p>}
        </div>
      )}

      {request.status === "rejected" && request.reject_reason && (
        <p className="rounded-sm bg-surface-sunken p-3 text-sm whitespace-pre-line">
          <span className="font-semibold">{t("reason")}: </span>
          {request.reject_reason}
        </p>
      )}
      {request.status === "approved" && request.shelter_id && (
        <Link href={`/shelters/${request.shelter_id}`} className="text-sm text-primary underline">
          {t("shelterPage")}
        </Link>
      )}

      {request.status === "submitted" && !rejecting && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending}
            loading={pending}
            onClick={() =>
              run(
                () => approveOnboarding(request.id),
                t(shelter ? "approveConfirmShelter" : "approveConfirmVolunteer", {
                  name: request.name,
                }),
              )
            }
          >
            <Check aria-hidden className="size-4" />
            {t("approve")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setRejecting(true)}
          >
            <X aria-hidden className="size-4" />
            {t("reject")}
          </Button>
        </div>
      )}

      {request.status === "submitted" && rejecting && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => rejectOnboarding(request.id, reason));
          }}
        >
          <Field label={t("reasonLabel")} hint={t("reasonHint")}>
            <Textarea
              rows={3}
              maxLength={2000}
              required
              minLength={3}
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || reason.trim().length < 3} loading={pending}>
              {t("rejectSubmit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setRejecting(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      <ModError code={error} />
    </li>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}
