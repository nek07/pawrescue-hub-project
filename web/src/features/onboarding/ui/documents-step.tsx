"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ErrorState, Field, Input } from "@/shared/ui";
import { reloadOnboarding, saveRecommender } from "../api/actions";
import {
  MAX_REGISTRATION_FILES,
  MAX_TERRITORY_PHOTOS,
  MIN_TERRITORY_PHOTOS,
  type Onboarding,
} from "../model/steps";
import { DocumentUploader } from "./document-uploader";
import { Section, useErrorText } from "./parts";

type StepProps = {
  draft: Onboarding;
  /** Загрузили или удалили файл — свежая заявка, шаг тот же */
  onUpdate: (request: Onboarding) => void;
  onSaved: (request: Onboarding) => void;
};

/** Шаг 2: документы приюта (только модераторам) и необязательный рекомендатель */
export function DocumentsStep({ draft, onUpdate, onSaved }: StepProps) {
  const t = useTranslations("onboarding");
  const errorText = useErrorText();
  const [recommender, setRecommender] = useState(draft.recommender ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();

  const reload = async () => {
    const result = await reloadOnboarding();
    if (result.ok) onUpdate(result.request);
  };

  // Загрузки сохраняются сразу; кнопка дописывает рекомендателя и ведёт дальше
  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setFieldError(undefined);
    const result = await saveRecommender(recommender);
    setSaving(false);
    if (result.ok) return onSaved(result.request);
    setFieldError(result.fieldErrors?.recommender);
    setError(result.formError);
  }

  const shelter = draft.type === "shelter";
  const photos = draft.documents.filter((d) => d.kind === "territory_photo");

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Section
        legend={t("documents.title")}
        hint={shelter ? t("documents.leadShelter") : t("documents.leadVolunteer")}
      >
        {shelter && (
          <>
            <DocumentUploader
              kind="registration"
              title={t("documents.registration")}
              hint={t("documents.registrationHint")}
              documents={draft.documents.filter((d) => d.kind === "registration")}
              max={MAX_REGISTRATION_FILES}
              onChanged={reload}
            />
            <DocumentUploader
              kind="territory_photo"
              title={t("documents.photos")}
              hint={t("documents.photosHint", {
                min: MIN_TERRITORY_PHOTOS,
                max: MAX_TERRITORY_PHOTOS,
                count: photos.filter((d) => d.confirmed).length,
              })}
              documents={photos}
              max={MAX_TERRITORY_PHOTOS}
              onChanged={reload}
            />
          </>
        )}
        <Field
          label={t("documents.recommender")}
          hint={t("documents.recommenderHint")}
          error={errorText(fieldError)}
        >
          <Input
            maxLength={200}
            value={recommender}
            onChange={(event) => setRecommender(event.target.value)}
          />
        </Field>
      </Section>

      {error && <ErrorState title={errorText(error)} />}

      <div>
        <Button type="submit" size="lg" loading={saving}>
          {saving ? t("saving") : t("next")}
        </Button>
      </div>
    </form>
  );
}
