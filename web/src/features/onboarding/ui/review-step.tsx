"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button, ErrorState } from "@/shared/ui";
import { submitOnboarding } from "../api/actions";
import { MISSING_STEP, type Onboarding, type Step } from "../model/steps";
import { useErrorText } from "./parts";

type ReviewStepProps = {
  draft: Onboarding;
  onSaved: (request: Onboarding) => void;
  onEdit: (step: Step) => void;
};

/** Шаг 4: сводка всех шагов и отправка модератору */
export function ReviewStep({ draft, onSaved, onEdit }: ReviewStepProps) {
  const t = useTranslations("onboarding");
  const tCity = useTranslations("cities");
  const errorText = useErrorText();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  // Свежий список недостающего: из ответа submit, если API знает больше нас
  const [missing, setMissing] = useState(draft.missing);

  const shelter = draft.type === "shelter";
  const confirmed = draft.documents.filter((d) => d.confirmed);
  const empty = <span className="text-ink-muted">{t("review.empty")}</span>;

  async function submit() {
    setSubmitting(true);
    setError(undefined);
    const result = await submitOnboarding();
    setSubmitting(false);
    if (result.ok) return onSaved(result.request);
    if (result.fieldErrors) setMissing(Object.keys(result.fieldErrors));
    setError(result.formError);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5">
        <div>
          <h2 className="font-semibold">{t("review.title")}</h2>
          <p className="text-sm text-ink-muted">{t("review.lead")}</p>
        </div>

        <ReviewBlock
          title={t("steps.who")}
          onEdit={() => onEdit("who")}
          editLabel={t("review.edit")}
        >
          <Row label={t("who.type")}>{t(`type.${draft.type}`)}</Row>
          <Row label={t("who.name")}>{draft.name}</Row>
          <Row label={t("who.city")}>{draft.city ? tCity(draft.city) : empty}</Row>
          <Row label={t("who.phone")}>{draft.contact_phone ?? empty}</Row>
        </ReviewBlock>

        <ReviewBlock
          title={t("steps.documents")}
          onEdit={() => onEdit("documents")}
          editLabel={t("review.edit")}
        >
          {shelter && (
            <>
              <Row label={t("documents.registration")}>
                {t("review.files", {
                  count: confirmed.filter((d) => d.kind === "registration").length,
                })}
              </Row>
              <Row label={t("documents.photos")}>
                {t("review.files", {
                  count: confirmed.filter((d) => d.kind === "territory_photo").length,
                })}
              </Row>
            </>
          )}
          <Row label={t("documents.recommender")}>{draft.recommender ?? empty}</Row>
        </ReviewBlock>

        <ReviewBlock
          title={t("steps.profile")}
          onEdit={() => onEdit("profile")}
          editLabel={t("review.edit")}
        >
          <Row label={shelter ? t("profile.aboutShelter") : t("profile.aboutVolunteer")}>
            {draft.about ? <span className="whitespace-pre-line">{draft.about}</span> : empty}
          </Row>
          {shelter && (
            <>
              <Row label={t("profile.address")}>{draft.address ?? empty}</Row>
              <Row label={t("profile.visitHours")}>{draft.visit_hours ?? empty}</Row>
            </>
          )}
        </ReviewBlock>
      </div>

      {missing.length > 0 && (
        <div className="flex flex-col gap-2 rounded-sm bg-accent p-4 text-sm text-on-accent">
          <p className="font-semibold">{t("review.missingTitle")}</p>
          <ul className="flex flex-col gap-1">
            {missing.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="underline"
                  onClick={() => onEdit(MISSING_STEP[item] ?? "who")}
                >
                  {t.has(`missing.${item}` as "missing.city")
                    ? t(`missing.${item}` as "missing.city")
                    : item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && error !== "onboarding_incomplete" && <ErrorState title={errorText(error)} />}

      <div className="flex flex-col gap-2">
        <div>
          <Button
            type="button"
            size="lg"
            loading={submitting}
            disabled={missing.length > 0}
            onClick={() => void submit()}
          >
            {submitting ? t("review.submitting") : t("review.submit")}
          </Button>
        </div>
        <p className="text-sm text-ink-muted">{t("review.note")}</p>
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          {editLabel}
        </Button>
      </div>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">{children}</dl>
    </section>
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
