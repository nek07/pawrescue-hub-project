"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, ErrorState, Field, Input, Textarea } from "@/shared/ui";
import { saveProfile } from "../api/actions";
import {
  profileSchema,
  type Onboarding,
  type ProfileData,
  type ProfileInput,
} from "../model/steps";
import { Section, useErrorText } from "./parts";

type StepProps = { draft: Onboarding; onSaved: (request: Onboarding) => void };

/** Шаг 3: то, что увидят люди в профиле приюта или волонтёра */
export function ProfileStep({ draft, onSaved }: StepProps) {
  const t = useTranslations("onboarding");
  const errorText = useErrorText();
  const [formError, setFormError] = useState<string>();
  const shelter = draft.type === "shelter";

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput, unknown, ProfileData>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
    defaultValues: {
      about: draft.about ?? "",
      address: draft.address ?? "",
      visitHours: draft.visit_hours ?? "",
    },
  });

  const onSubmit = handleSubmit(async () => {
    setFormError(undefined);
    const result = await saveProfile(getValues());
    if (result.ok) return onSaved(result.request);
    for (const [field, code] of Object.entries(result.fieldErrors ?? {})) {
      if (field in profileSchema.shape) {
        setError(field as keyof ProfileInput, { message: code }, { shouldFocus: true });
      }
    }
    setFormError(result.formError);
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Section legend={t("profile.title")} hint={t("profile.lead")}>
        <Field
          label={shelter ? t("profile.aboutShelter") : t("profile.aboutVolunteer")}
          hint={t("profile.aboutHint")}
          error={errorText(errors.about?.message)}
        >
          <Textarea rows={6} maxLength={3000} {...register("about")} />
        </Field>
        {shelter && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("profile.address")}
              hint={t("profile.addressHint")}
              error={errorText(errors.address?.message)}
            >
              <Input autoComplete="street-address" maxLength={255} {...register("address")} />
            </Field>
            <Field
              label={t("profile.visitHours")}
              hint={t("profile.visitHoursHint")}
              error={errorText(errors.visitHours?.message)}
            >
              <Input
                maxLength={120}
                placeholder={t("profile.visitHoursPlaceholder")}
                {...register("visitHours")}
              />
            </Field>
          </div>
        )}
      </Section>

      {formError && <ErrorState title={errorText(formError)} />}

      <div>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? t("saving") : t("next")}
        </Button>
      </div>
    </form>
  );
}
